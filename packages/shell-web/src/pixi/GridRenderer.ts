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
import { chebyshev, cellEq, type Cell, type RunState, type Tile } from "@gridlore/engine";
import { t } from "../i18n.js";
import {
  COLORS,
  EMOJI_FONT_FAMILY,
  ENEMY_EMOJI,
  EXIT_EMOJI,
  HERO_EMOJI,
  LOCK_EMOJI,
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

export class GridRenderer {
  private readonly app: Application;
  private readonly board: Container;
  private readonly cellLayer: Container;
  private readonly tileLayer: Container;
  private readonly highlightLayer: Container;
  private readonly heroLayer: Container;
  private readonly dividerLayer: Container;
  private cellWidth = 0;
  private cellHeight = 0;
  private currentState: RunState | null = null;
  private moveHandler: MoveHandler = () => {};

  constructor(app: Application) {
    this.app = app;
    this.board = new Container();
    this.app.stage.addChild(this.board);

    this.cellLayer = new Container();
    this.dividerLayer = new Container();
    this.highlightLayer = new Container();
    this.tileLayer = new Container();
    this.heroLayer = new Container();

    this.board.addChild(this.cellLayer);
    this.board.addChild(this.dividerLayer);
    this.board.addChild(this.highlightLayer);
    this.board.addChild(this.tileLayer);
    this.board.addChild(this.heroLayer);
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

  render(state: RunState): void {
    this.currentState = state;
    this.layout();
    this.drawCells();
    this.drawDividers();
    this.drawTiles();
    this.drawHighlights();
    this.drawHero();
  }

  private layout(): void {
    if (!this.currentState) return;
    const canvas = this.app.canvas;
    const w = canvas.clientWidth || canvas.width;
    const h = canvas.clientHeight || canvas.height;
    const availW = Math.max(0, w - BOARD_PADDING * 2);
    const availH = Math.max(0, h - BOARD_PADDING * 2);
    const gridSize = this.currentState.currentFloor.grid.size;

    // Pick the largest cell width that satisfies both axes.
    const maxCellW = availW / gridSize;
    const maxCellH = availH / gridSize;
    const cellW = Math.floor(Math.min(maxCellW, maxCellH * CARD_ASPECT));
    const cellH = Math.floor(cellW / CARD_ASPECT);
    this.cellWidth = cellW;
    this.cellHeight = cellH;

    const boardW = cellW * gridSize;
    const boardH = cellH * gridSize;
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

    for (let y = 0; y < grid.size; y++) {
      for (let x = 0; x < grid.size; x++) {
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
        if (c.x < 0 || c.x >= grid.size || c.y < 0 || c.y >= grid.size) continue;
        if (chebyshev(hero.position, c) > stride) continue;
        const tile = grid.get(c);
        if (tile.anchored) continue;
        if (tile.kind === "exit" && !exitUnlocked) continue;
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
    const { hero } = this.currentState;
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
