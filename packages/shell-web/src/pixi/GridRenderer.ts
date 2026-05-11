/**
 * Pixi v8 grid renderer.
 *
 * Sizing notes (the load-bearing part):
 * - We do NOT use `resizeTo` because that only listens to `window.resize`,
 *   not to the host element's flex-layout changes. We size the renderer
 *   explicitly via resize() and call it from a ResizeObserver in GridView.
 * - All layout math uses CSS pixels (canvas.clientWidth/Height). Pixi's
 *   stage works in CSS pixels when autoDensity + resolution=DPR are set.
 * - Cells are TALL: width / height = CARD_ASPECT (default 9:16). The
 *   board fits the largest cell width that satisfies both the
 *   available width and (cellWidth/CARD_ASPECT) × N <= available height.
 *
 * Card content (emojis, corner stats) scales to cardWidth, which is
 * the constraining dimension when CARD_ASPECT < 1.
 */

import { Application, Container, Graphics, Text, type FederatedPointerEvent } from "pixi.js";
import { chebyshev, cellEq, type Cell, type GameEvent, type Rune, type RunState, type Tile } from "@gridlore/engine";
import { t } from "../i18n.js";
import {
  COLORS,
  EMOJI_FONT_FAMILY,
  ENEMY_EMOJI,
  EXIT_EMOJI,
  HERO_EMOJI,
  KEY_EMOJI,
  LOCK_EMOJI,
  RUNE_COLORS,
  RUNE_EMOJI,
  RUNE_PASSIVE,
} from "./palette.js";

type MoveHandler = (cell: Cell) => void;

const BOARD_PADDING = 4;
/** Card width / height — e.g. 9/16 makes tall cards. */
const CARD_ASPECT = 9 / 16;
/** Inner-card margin as a fraction of cell width. */
const CARD_MARGIN_FRAC = 0.07;
const TILE_EMOJI_SCALE = 0.52;
const HERO_EMOJI_SCALE = 0.52;
const DEFAULT_ANIM_SPEED = 0.7;
const BASE_ATTACK_LUNGE_MS = 360;
const BASE_HIT_FLASH_MS = 260;
const BASE_DAMAGE_FLOAT_MS = 560;
const BASE_LATTICE_PULSE_MS = 620;
const BASE_LATTICE_POP_MS = 520;

export class GridRenderer {
  private readonly app: Application;
  private readonly board: Container;
  private readonly cellLayer: Container;
  private readonly tileLayer: Container;
  private readonly highlightLayer: Container;
  private readonly heroLayer: Container;
  private readonly dividerLayer: Container;
  private readonly animationLayer: Container;
  private cellWidth = 0;
  private cellHeight = 0;
  private currentState: RunState | null = null;
  private lastAnimKey: string | null = null;
  private moveHandler: MoveHandler = () => {};
  private animSpeed = DEFAULT_ANIM_SPEED;
  private readonly activeAnimations: {
    readonly node: Container;
    elapsedMs: number;
    readonly durationMs: number;
    readonly update: (t: number) => void;
  }[] = [];

  constructor(app: Application) {
    this.app = app;
    this.board = new Container();
    this.app.stage.addChild(this.board);

    this.cellLayer = new Container();
    this.dividerLayer = new Container();
    this.highlightLayer = new Container();
    this.tileLayer = new Container();
    this.heroLayer = new Container();
    this.animationLayer = new Container();

    this.board.addChild(this.cellLayer);
    this.board.addChild(this.dividerLayer);
    this.board.addChild(this.highlightLayer);
    this.board.addChild(this.tileLayer);
    this.board.addChild(this.heroLayer);
    this.board.addChild(this.animationLayer);

    this.app.ticker.add((ticker) => {
      const dtMs = (ticker.deltaMS ?? 16.6667) as number;
      this.stepAnimations(dtMs);
    });
  }

  static async create(parent: HTMLElement): Promise<GridRenderer> {
    const app = new Application();
    const w = Math.max(1, parent.clientWidth);
    const h = Math.max(1, parent.clientHeight);
    await app.init({
      background: COLORS.bg,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
      width: w,
      height: h,
    });
    parent.appendChild(app.canvas);
    return new GridRenderer(app);
  }

  destroy(): void {
    this.app.destroy(true, { children: true });
  }

  setMoveHandler(handler: MoveHandler): void {
    this.moveHandler = handler;
  }

  setAnimSpeed(speed: number): void {
    if (!Number.isFinite(speed)) return;
    this.animSpeed = clamp(speed, 0.2, 2);
  }

  resize(): void {
    const canvas = this.app.canvas;
    const parent = canvas.parentElement;
    if (!parent) return;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    if (w <= 0 || h <= 0) return;
    if (canvas.clientWidth === w && canvas.clientHeight === h) return;
    this.app.renderer.resize(w, h);
    if (this.currentState) this.render(this.currentState);
  }

  render(state: RunState, events?: readonly GameEvent[]): void {
    this.currentState = state;
    this.layout();
    this.drawCells();
    this.drawDividers();
    this.drawTiles();
    this.drawHighlights();
    this.drawHero();
    if (events && events.length > 0) this.maybeAnimate(events, state);
  }

  private stepAnimations(dtMs: number): void {
    if (this.activeAnimations.length === 0) return;
    for (let i = this.activeAnimations.length - 1; i >= 0; i--) {
      const a = this.activeAnimations[i]!;
      a.elapsedMs += dtMs;
      const t = Math.max(0, Math.min(1, a.elapsedMs / a.durationMs));
      a.update(t);
      if (t >= 1) {
        a.node.destroy({ children: true });
        this.activeAnimations.splice(i, 1);
      }
    }
  }

  private maybeAnimate(events: readonly GameEvent[], state: RunState): void {
    const key = this.eventsKey(events, state);
    if (this.lastAnimKey === key) return;
    this.lastAnimKey = key;

    for (const e of events) {
      switch (e.type) {
        case "DAMAGE_DEALT": {
          if (e.amount <= 0) break;
          const source = e.source;
          const target = e.target;
          const heroId = "hero";

          if (source === heroId && target !== heroId) {
            const heroCell = state.hero.position;
            const targetCell = this.enemyCellFromEventsOrState(String(target), events, state);
            if (!targetCell) break;
            this.animateAttack({
              attackerEmoji: HERO_EMOJI,
              from: heroCell,
              to: targetCell,
              showDamage: e.amount,
            });
          } else if (target === heroId && source !== heroId) {
            const enemyId = String(source);
            const enemyCell = this.enemyCellFromEventsOrState(enemyId, events, state);
            if (!enemyCell) break;
            const enemy = state.currentFloor.enemies.get(enemyId);
            const emoji = enemy ? ENEMY_EMOJI[enemy.templateId] ?? "👾" : "👾";
            this.animateAttack({
              attackerEmoji: emoji,
              from: enemyCell,
              to: state.hero.position,
              showDamage: e.amount,
            });
          }
          break;
        }
        case "LATTICE_CHARGED": {
          this.animateLatticeCharged(String(e.lattice), e.keystone, state);
          break;
        }
        default:
          break;
      }
    }
  }

  private eventsKey(events: readonly GameEvent[], state: RunState): string {
    const parts: string[] = [`t:${state.turn}`, `f:${state.currentFloor.turn}`];
    for (const e of events) {
      switch (e.type) {
        case "DAMAGE_DEALT":
          parts.push(`d:${e.source}:${e.target}:${e.amount}`);
          break;
        case "LATTICE_CHARGED":
          parts.push(`lc:${e.lattice}:${e.keystone}`);
          break;
        case "ENEMY_ATTACKED":
          parts.push(`ea:${e.enemyId}:${e.cell.x},${e.cell.y}`);
          break;
        case "ENEMY_KILLED":
          parts.push(`ek:${e.enemyId}:${e.cell.x},${e.cell.y}`);
          break;
        case "HERO_DAMAGED":
          parts.push(`hd:${e.amount}:${e.hpAfter}`);
          break;
        default:
          break;
      }
    }
    return parts.join("|");
  }

  private enemyCellFromEventsOrState(
    enemyId: string,
    events: readonly GameEvent[],
    state: RunState,
  ): Cell | null {
    const alive = state.currentFloor.enemies.get(enemyId);
    if (alive) return alive.position;
    for (const e of events) {
      if (e.type === "ENEMY_KILLED" && e.enemyId === enemyId) return e.cell;
      if (e.type === "ENEMY_ATTACKED" && e.enemyId === enemyId) return e.cell;
    }
    return null;
  }

  private animateAttack(opts: { attackerEmoji: string; from: Cell; to: Cell; showDamage: number }): void {
    const fromPx = this.cellCenterPx(opts.from);
    const toPx = this.cellCenterPx(opts.to);
    const lunge = new Text({
      text: opts.attackerEmoji,
      style: {
        fontFamily: EMOJI_FONT_FAMILY,
        fontSize: Math.max(12, Math.floor(this.cardDims().cardW * 0.42)),
        fill: 0xffffff,
      },
    });
    lunge.anchor.set(0.5);
    lunge.position.set(fromPx.x, fromPx.y);
    this.animationLayer.addChild(lunge);

    const durationMs = this.animMs(BASE_ATTACK_LUNGE_MS);
    const update = (t: number) => {
      const phase = t < 0.55 ? t / 0.55 : 1 - (t - 0.55) / 0.45;
      const eased = easeOutCubic(Math.max(0, Math.min(1, phase)));
      lunge.position.set(lerp(fromPx.x, toPx.x, eased), lerp(fromPx.y, toPx.y, eased));
      const s = 1 + 0.12 * Math.sin(Math.PI * Math.min(1, t));
      lunge.scale.set(s);
      lunge.alpha = 1 - 0.15 * t;
      if (t >= 0.55) lunge.alpha = 0.85;
    };
    this.activeAnimations.push({ node: lunge, elapsedMs: 0, durationMs, update });

    this.hitFlash(opts.to);
    this.damageNumber(opts.to, opts.showDamage);
  }

  private hitFlash(cell: Cell): void {
    const { cardW, cardH, marginX, marginY, radius } = this.cardDims();
    const x = cell.x * this.cellWidth + marginX;
    const y = cell.y * this.cellHeight + marginY;
    const g = new Graphics();
    g.roundRect(x, y, cardW, cardH, radius).fill({ color: 0xff3b3b, alpha: 0.35 });
    g.alpha = 0;
    this.animationLayer.addChild(g);
    const durationMs = this.animMs(BASE_HIT_FLASH_MS);
    const update = (t: number) => {
      const peak = Math.sin(Math.PI * t);
      g.alpha = 0.55 * peak;
    };
    this.activeAnimations.push({ node: g, elapsedMs: 0, durationMs, update });
  }

  private damageNumber(cell: Cell, amount: number): void {
    const c = this.cellCenterPx(cell);
    const dmg = new Text({
      text: `-${amount}`,
      style: {
        fontFamily: "ui-monospace, SF Mono, monospace",
        fontSize: Math.max(12, Math.floor(this.cardDims().cardW * 0.18)),
        fill: 0xffffff,
        fontWeight: "800",
        stroke: { color: 0x000000, width: 3 },
      },
    });
    dmg.anchor.set(0.5);
    dmg.position.set(c.x, c.y - this.cardDims().cardH * 0.12);
    this.animationLayer.addChild(dmg);
    const durationMs = this.animMs(BASE_DAMAGE_FLOAT_MS);
    const update = (t: number) => {
      dmg.alpha = 1 - t;
      dmg.position.set(c.x, c.y - this.cardDims().cardH * (0.12 + 0.22 * easeOutCubic(t)));
      const s = 1 + 0.1 * Math.sin(Math.PI * (1 - t));
      dmg.scale.set(s);
    };
    this.activeAnimations.push({ node: dmg, elapsedMs: 0, durationMs, update });
  }

  private animateLatticeCharged(lattice: string, keystone: Rune, state: RunState): void {
    const cells = this.latticeCells(lattice, state);
    if (!cells) return;

    const color = RUNE_COLORS[keystone] ?? 0xffd95a;
    const group = new Container();
    group.alpha = 0;
    this.animationLayer.addChild(group);

    const { cardW, cardH, marginX, marginY, radius } = this.cardDims();
    for (const cell of cells) {
      const x = cell.x * this.cellWidth + marginX;
      const y = cell.y * this.cellHeight + marginY;
      const g = new Graphics();
      g.roundRect(x, y, cardW, cardH, radius).fill({ color, alpha: 0.12 });
      g.roundRect(x, y, cardW, cardH, radius).stroke({ color, width: 4, alpha: 0.9 });
      group.addChild(g);
    }

    const center = this.cellsCenterPx(cells);
    const emoji = new Text({
      text: `${RUNE_EMOJI[keystone]}⚡`,
      style: {
        fontFamily: EMOJI_FONT_FAMILY,
        fontSize: Math.max(14, Math.floor(cardW * 0.5)),
        fill: 0xffffff,
      },
    });
    emoji.anchor.set(0.5);
    emoji.position.set(center.x, center.y);
    group.addChild(emoji);

    const pulseUpdate = (t: number) => {
      const peak = Math.sin(Math.PI * t);
      group.alpha = 0.9 * peak;
      const s = 1 + 0.03 * peak;
      group.scale.set(s);
      emoji.scale.set(1 + 0.18 * easeOutCubic(peak));
    };
    this.activeAnimations.push({ node: group, elapsedMs: 0, durationMs: this.animMs(BASE_LATTICE_PULSE_MS), update: pulseUpdate });

    this.latticePopRing(center, color);
  }

  private latticePopRing(center: { x: number; y: number }, color: number): void {
    const ring = new Graphics();
    ring.position.set(center.x, center.y);
    ring.alpha = 0;
    this.animationLayer.addChild(ring);

    const maxR = Math.max(10, Math.floor(this.cardDims().cardW * 0.55));
    const update = (t: number) => {
      ring.clear();
      const eased = easeOutCubic(t);
      const r = 6 + (maxR - 6) * eased;
      ring.circle(0, 0, r).stroke({ color, width: 4, alpha: 1 - t });
      ring.alpha = 1 - t;
    };
    this.activeAnimations.push({ node: ring, elapsedMs: 0, durationMs: this.animMs(BASE_LATTICE_POP_MS), update });
  }

  private animMs(baseMs: number): number {
    return Math.max(1, Math.round(baseMs / this.animSpeed));
  }

  private cellsCenterPx(cells: readonly Cell[]): { x: number; y: number } {
    let sx = 0;
    let sy = 0;
    for (const c of cells) {
      const p = this.cellCenterPx(c);
      sx += p.x;
      sy += p.y;
    }
    const n = Math.max(1, cells.length);
    return { x: sx / n, y: sy / n };
  }

  private latticeCells(lattice: string, state: RunState): Cell[] | null {
    const [kind, idxRaw] = lattice.split(":");
    const idx = idxRaw ? Number(idxRaw) : NaN;
    if (!Number.isFinite(idx)) return null;

    const grid = state.currentFloor.grid;
    if (kind === "row") {
      const y = idx;
      if (y < 0 || y >= grid.height) return null;
      const out: Cell[] = [];
      for (let x = 0; x < grid.width; x++) out.push({ x, y });
      return out;
    }
    if (kind === "column") {
      const x = idx;
      if (x < 0 || x >= grid.width) return null;
      const out: Cell[] = [];
      for (let y = 0; y < grid.height; y++) out.push({ x, y });
      return out;
    }
    if (kind === "chamber") {
      const chambersPerRow = grid.width / grid.chamberWidth;
      const cx = idx % chambersPerRow;
      const cy = Math.floor(idx / chambersPerRow);
      const x0 = cx * grid.chamberWidth;
      const y0 = cy * grid.chamberHeight;
      const out: Cell[] = [];
      for (let dy = 0; dy < grid.chamberHeight; dy++) {
        for (let dx = 0; dx < grid.chamberWidth; dx++) {
          out.push({ x: x0 + dx, y: y0 + dy });
        }
      }
      return out;
    }
    return null;
  }

  private cellCenterPx(cell: Cell): { x: number; y: number } {
    return {
      x: cell.x * this.cellWidth + this.cellWidth / 2,
      y: cell.y * this.cellHeight + this.cellHeight / 2,
    };
  }

  private layout(): void {
    if (!this.currentState) return;
    const canvas = this.app.canvas;
    const w = canvas.clientWidth || canvas.width;
    const h = canvas.clientHeight || canvas.height;
    const availW = Math.max(0, w - BOARD_PADDING * 2);
    const availH = Math.max(0, h - BOARD_PADDING * 2);
    const gridW = this.currentState.currentFloor.grid.width;
    const gridH = this.currentState.currentFloor.grid.height;

    // Pick the largest cell width that satisfies both axes.
    const maxCellW = availW / gridW;
    const maxCellH = availH / gridH;
    const cellW = Math.floor(Math.min(maxCellW, maxCellH * CARD_ASPECT));
    const cellH = Math.floor(cellW / CARD_ASPECT);
    this.cellWidth = cellW;
    this.cellHeight = cellH;

    const boardW = cellW * gridW;
    const boardH = cellH * gridH;
    this.board.position.set(
      Math.round((w - boardW) / 2),
      Math.round((h - boardH) / 2),
    );
  }

  private cardDims(): { cardW: number; cardH: number; marginX: number; marginY: number; radius: number } {
    const marginX = Math.max(3, Math.floor(this.cellWidth * CARD_MARGIN_FRAC));
    const marginY = Math.max(3, Math.floor(this.cellHeight * CARD_MARGIN_FRAC));
    const cardW = this.cellWidth - marginX * 2;
    const cardH = this.cellHeight - marginY * 2;
    const radius = Math.max(6, Math.floor(Math.min(cardW, cardH) * 0.1));
    return { cardW, cardH, marginX, marginY, radius };
  }

  private drawCells(): void {
    if (!this.currentState) return;
    const state = this.currentState;
    const grid = state.currentFloor.grid;
    this.cellLayer.removeChildren();
    const exitUnlocked = state.currentFloor.exitUnlocked;
    const { cardW, cardH, marginX, marginY, radius } = this.cardDims();

    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const tile = grid.get({ x, y });
        const isExit = tile.kind === "exit";
        const isEnemy = tile.kind === "enemy";
        const isHero = cellEq({ x, y }, state.hero.position);
        const tinted = isCellInChargedLattice(state, { x, y });
        const fill = isHero
          ? COLORS.heroCardFill
          : isEnemy
            ? COLORS.enemyCardFill
            : isExit
              ? exitUnlocked
                ? COLORS.exitFill
                : COLORS.exitLockedFill
              : tinted
                ? COLORS.cellChargedTint
                : COLORS.cellEmpty;

        const cardX = x * this.cellWidth + marginX;
        const cardY = y * this.cellHeight + marginY;
        const strokeColor = isHero
          ? COLORS.heroOutline
          : isEnemy
            ? COLORS.enemyCardStroke
            : isExit
              ? exitUnlocked
                ? COLORS.exitStroke
                : COLORS.exitLockedStroke
              : COLORS.cardBorder;
        const strokeWidth = isHero || isEnemy ? 2 : isExit ? 2 : 1;
        const strokeAlpha = isHero || isExit || isEnemy ? 0.95 : 0.55;

        const g = new Graphics();
        g.roundRect(cardX + 2, cardY + 3, cardW, cardH, radius).fill({
          color: COLORS.cardShadow,
          alpha: 0.4,
        });
        g.roundRect(cardX, cardY, cardW, cardH, radius).fill(fill);
        g.roundRect(cardX, cardY, cardW, cardH, radius).stroke({
          color: strokeColor,
          width: strokeWidth,
          alpha: strokeAlpha,
        });

        g.eventMode = "static";
        g.cursor = isExit && !exitUnlocked ? "not-allowed" : "pointer";
        g.on("pointertap", (e: FederatedPointerEvent) => {
          e.stopPropagation();
          this.moveHandler({ x, y });
        });
        this.cellLayer.addChild(g);
      }
    }
  }

  private drawDividers(): void {
    this.dividerLayer.removeChildren();
  }

  private drawTiles(): void {
    if (!this.currentState) return;
    const state = this.currentState;
    const grid = state.currentFloor.grid;
    this.tileLayer.removeChildren();

    for (const { cell, tile } of grid.each()) {
      const cx = cell.x * this.cellWidth + this.cellWidth / 2;
      const cy = cell.y * this.cellHeight + this.cellHeight / 2;
      this.drawTileBase(tile, cx, cy, state);
    }
    for (const { cell, tile } of grid.each()) {
      const cx = cell.x * this.cellWidth + this.cellWidth / 2;
      const cy = cell.y * this.cellHeight + this.cellHeight / 2;
      this.drawTileOverlay(tile, cx, cy, state);
    }
  }

  private drawTileBase(tile: Tile, cx: number, cy: number, state: RunState): void {
    const { cardW, cardH } = this.cardDims();
    const exitUnlocked = state.currentFloor.exitUnlocked;
    // Width is the constraining dimension when cards are tall.
    const contentScale = cardW;
    switch (tile.kind) {
      case "rune": {
        if (!tile.rune) return;
        this.addEmoji(RUNE_EMOJI[tile.rune], cx, cy, contentScale * TILE_EMOJI_SCALE);
        return;
      }
      case "key": {
        this.addEmoji(KEY_EMOJI, cx, cy, contentScale * TILE_EMOJI_SCALE);
        return;
      }
      case "enemy": {
        const enemyId =
          tile.payload && tile.payload.kind === "enemy" ? tile.payload.enemyId : null;
        const enemy = enemyId ? state.currentFloor.enemies.get(enemyId) : undefined;
        const emoji = enemy ? ENEMY_EMOJI[enemy.templateId] ?? "👾" : "👾";
        this.addEmoji(emoji, cx, cy, contentScale * TILE_EMOJI_SCALE);
        return;
      }
      case "exit": {
        this.addEmoji(
          exitUnlocked ? EXIT_EMOJI : LOCK_EMOJI,
          cx,
          cy - cardH * 0.05,
          contentScale * TILE_EMOJI_SCALE,
        );
        return;
      }
      default:
        return;
    }
  }

  private drawTileOverlay(tile: Tile, cx: number, cy: number, state: RunState): void {
    const { cardW, cardH } = this.cardDims();
    const exitUnlocked = state.currentFloor.exitUnlocked;
    const contentScale = cardW;
    switch (tile.kind) {
      case "rune": {
        if (!tile.rune) return;
        const passive = RUNE_PASSIVE[tile.rune];
        if (!passive) return;
        this.addCornerIconValue(
          passive.icon,
          `+${passive.amount}`,
          cx + cardW / 2,
          cy - cardH / 2,
          "right-top",
          contentScale,
          COLORS.cornerStat,
        );
        return;
      }
      case "enemy": {
        const enemyId =
          tile.payload && tile.payload.kind === "enemy" ? tile.payload.enemyId : null;
        const enemy = enemyId ? state.currentFloor.enemies.get(enemyId) : undefined;
        if (!enemy) return;
        this.addCornerIconValue(
          "♥",
          `${enemy.hp}`,
          cx + cardW / 2,
          cy - cardH / 2,
          "right-top",
          contentScale,
          COLORS.hpStat,
        );
        this.addCornerIconValue(
          "⚔",
          `${enemy.attack}`,
          cx - cardW / 2,
          cy - cardH / 2,
          "left-top",
          contentScale,
          COLORS.attackStat,
        );

        if (
          state.currentFloor.exitRequiresKey &&
          !state.currentFloor.exitUnlocked &&
          state.currentFloor.keyEnemyId === enemy.id
        ) {
          const pad = Math.floor(contentScale * 0.06);
          const key = new Text({
            text: KEY_EMOJI,
            style: {
              fontFamily: EMOJI_FONT_FAMILY,
              fontSize: Math.max(10, Math.floor(contentScale * 0.14)),
              fill: COLORS.cornerStat,
              fontWeight: "700",
            },
          });
          key.anchor.set(0, 1);
          key.position.set(cx - cardW / 2 + pad, cy + cardH / 2 - pad);
          this.tileLayer.addChild(key);
        }
        return;
      }
      case "exit": {
        const color = exitUnlocked ? COLORS.exitStroke : COLORS.exitLockedStroke;
        const label = new Text({
          text: exitUnlocked ? t("tile.exit") : t("tile.lock"),
          style: {
            fontFamily: "ui-monospace, monospace",
            fontSize: Math.max(9, Math.floor(contentScale * 0.18)),
            fill: color,
            fontWeight: "600",
            letterSpacing: 1,
          },
        });
        label.anchor.set(0.5);
        label.position.set(cx, cy + cardH * 0.32);
        this.tileLayer.addChild(label);
        return;
      }
      default:
        return;
    }
  }

  private addEmoji(text: string, cx: number, cy: number, fontSize: number): void {
    const t = new Text({
      text,
      style: {
        fontFamily: EMOJI_FONT_FAMILY,
        fontSize: Math.floor(fontSize),
        fill: 0xffffff,
      },
    });
    t.anchor.set(0.5);
    t.position.set(cx, cy);
    this.tileLayer.addChild(t);
  }

  private addCornerIconValue(
    icon: string,
    value: string,
    anchorX: number,
    anchorY: number,
    corner: "right-top" | "left-top" | "right-bottom" | "left-bottom",
    contentScale: number,
    fill: number = COLORS.cornerStat,
    layer?: Container,
  ): void {
    const targetLayer = layer ?? this.tileLayer;
    const iconFontSize = Math.max(9, Math.floor(contentScale * 0.15));
    const valueFontSize = Math.max(8, Math.floor(iconFontSize * 0.92));
    const padding = Math.max(6, Math.floor(iconFontSize * 0.9));
    const pad = Math.floor(contentScale * 0.06);
    const ax = corner.startsWith("right") ? 1 : 0;
    const isTop = corner.endsWith("top");
    const ay = isTop ? 0 : 1;
    const px = corner.startsWith("right") ? anchorX - pad : anchorX + pad;
    const py = isTop ? anchorY + pad : anchorY - pad;
    const lineStep = Math.floor(iconFontSize * 0.9);

    const iconText = new Text({
      text: `${icon}\n`,
      style: {
        fontFamily: EMOJI_FONT_FAMILY,
        fontSize: iconFontSize,
        fill,
        fontWeight: "700",
        padding,
      },
    });
    iconText.anchor.set(ax, ay);

    const valueText = new Text({
      text: value,
      style: {
        fontFamily: "ui-monospace, SF Mono, monospace",
        fontSize: valueFontSize,
        fill,
        fontWeight: "700",
      },
    });
    valueText.anchor.set(ax, ay);

    if (isTop) {
      iconText.position.set(px, py);
      valueText.position.set(px, py + lineStep);
    } else {
      valueText.position.set(px, py);
      iconText.position.set(px, py - lineStep);
    }
    targetLayer.addChild(iconText);
    targetLayer.addChild(valueText);
  }

  private drawHighlights(): void {
    if (!this.currentState) return;
    const state = this.currentState;
    const { hero } = state;
    const grid = state.currentFloor.grid;
    this.highlightLayer.removeChildren();
    const stride = hero.stride;
    const exitUnlocked = state.currentFloor.exitUnlocked;
    const { cardW, cardH, marginX, marginY, radius } = this.cardDims();
    const inset = 3;

    for (let dy = -stride; dy <= stride; dy++) {
      for (let dx = -stride; dx <= stride; dx++) {
        if (dx === 0 && dy === 0) continue;
        const c: Cell = { x: hero.position.x + dx, y: hero.position.y + dy };
        if (c.x < 0 || c.x >= grid.width || c.y < 0 || c.y >= grid.height) continue;
        if (chebyshev(hero.position, c) > stride) continue;
        const tile = grid.get(c);
        if (tile.anchored) continue;
        if (tile.kind === "exit" && !exitUnlocked) continue;
        // Exit already has its own border styling (unlocked/locked) — don't double up.
        if (tile.kind === "exit") continue;
        // Enemy cards already wear a bright red border — don't double up.
        if (tile.kind === "enemy") continue;

        const g = new Graphics();
        g.roundRect(
          c.x * this.cellWidth + marginX + inset,
          c.y * this.cellHeight + marginY + inset,
          cardW - inset * 2,
          cardH - inset * 2,
          radius,
        );
        g.stroke({ color: COLORS.cellLegalMove, width: 3, alpha: 0.95 });
        this.highlightLayer.addChild(g);
      }
    }
  }

  private drawHero(): void {
    if (!this.currentState) return;
    const state = this.currentState;
    const { hero } = state;
    this.heroLayer.removeChildren();
    const { cardW, cardH } = this.cardDims();
    const contentScale = cardW;
    const cx = hero.position.x * this.cellWidth + this.cellWidth / 2;
    const cy = hero.position.y * this.cellHeight + this.cellHeight / 2;

    const emoji = new Text({
      text: HERO_EMOJI,
      style: {
        fontFamily: EMOJI_FONT_FAMILY,
        fontSize: Math.floor(contentScale * HERO_EMOJI_SCALE),
        fill: 0xffffff,
      },
    });
    emoji.anchor.set(0.5);
    emoji.position.set(cx, cy + cardH * 0.03);
    this.heroLayer.addChild(emoji);

    const standingOn = state.currentFloor.grid.get(hero.position);
    if (standingOn.kind === "key") {
      const key = new Text({
        text: KEY_EMOJI,
        style: {
          fontFamily: EMOJI_FONT_FAMILY,
          fontSize: Math.floor(contentScale * 0.28),
          fill: 0xffffff,
        },
      });
      key.anchor.set(0.5);
      key.position.set(cx, cy - cardH * 0.27);
      this.heroLayer.addChild(key);
    }

    this.addCornerIconValue(
      "♥",
      `${hero.hp}`,
      cx + cardW / 2,
      cy - cardH / 2,
      "right-top",
      contentScale,
      COLORS.cornerStat,
      this.heroLayer,
    );
    this.addCornerIconValue(
      "⚔",
      `${hero.attack}`,
      cx - cardW / 2,
      cy - cardH / 2,
      "left-top",
      contentScale,
      COLORS.attackStat,
      this.heroLayer,
    );

    if (hero.armor > 0) {
      this.addCornerIconValue(
        "🛡",
        `${hero.armor}`,
        cx + cardW / 2,
        cy + cardH / 2,
        "right-bottom",
        contentScale,
        COLORS.cornerStat,
        this.heroLayer,
      );
    }
  }
}

function isCellInChargedLattice(state: RunState, cell: Cell): boolean {
  const snap = state.currentFloor.lattices;
  if (snap.byId.get(`row:${cell.y}`)?.isCharged) return true;
  if (snap.byId.get(`column:${cell.x}`)?.isCharged) return true;
  const idx = state.currentFloor.grid.chamberIndex(cell);
  return snap.byId.get(`chamber:${idx}`)?.isCharged === true;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function easeOutCubic(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
