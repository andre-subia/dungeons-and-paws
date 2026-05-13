import { useEffect, useRef, useState } from "react";
import { cellEq, type Cell, type RunState } from "@gridlore/engine";
import { useRunStore } from "../state/store.js";
import { t } from "../i18n.js";
import { COLORS, FONTS, pixelChip, sectionLabel } from "../theme.js";

/**
 * Bottom-sheet minimap. Same UX as InventorySheet:
 *   - tap backdrop / swipe down / close button to dismiss
 *   - smooth open/close animation
 *   - data-swipe-exempt so gameplay swipes don't fire while open
 *
 * The minimap is drawn into a 2D canvas:
 *   - Unexplored cells render as opaque fog (deep abyss)
 *   - Explored floor cells render as muted slate
 *   - Walls (when explored) render as warm dark stone
 *   - Void cells (when explored) render as pure abyss
 *   - Exit (when explored) marked with a gold door pixel
 *   - Key (whenever it exists in the world, even through fog) marked gold
 *   - Hero rendered as a bright amber pulsing pixel at the current cell
 */
export function MapSheet({ onClose }: { onClose: () => void }) {
  const state = useRunStore((s) => s.state);
  const [phase, setPhase] = useState<"enter" | "open" | "exit">("enter");
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const swipeCloseRef = useRef<{ pointerId: number; startX: number; startY: number; startScrollTop: number } | null>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setPhase("open"));
    return () => cancelAnimationFrame(raf);
  }, []);

  function requestClose() {
    if (phase === "exit") return;
    setPhase("exit");
    window.setTimeout(() => onClose(), 170);
  }

  function onSheetPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse") return;
    if (!e.isPrimary) return;
    const scrollTop = sheetRef.current?.scrollTop ?? 0;
    swipeCloseRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, startScrollTop: scrollTop };
  }
  function onSheetPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const s = swipeCloseRef.current;
    if (!s || s.pointerId !== e.pointerId) return;
    if (s.startScrollTop > 0) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    const MIN_DOWN_PX = 26;
    const MAX_SLOP_PX = 56;
    if (dy > MIN_DOWN_PX && Math.abs(dx) <= MAX_SLOP_PX) {
      swipeCloseRef.current = null;
      e.preventDefault();
      requestClose();
    }
  }
  function onSheetPointerEnd(e: React.PointerEvent<HTMLDivElement>) {
    const s = swipeCloseRef.current;
    if (!s || s.pointerId !== e.pointerId) return;
    swipeCloseRef.current = null;
  }

  const exploredCount = state.currentFloor.explored.size;
  const totalCells = state.currentFloor.grid.width * state.currentFloor.grid.height;
  const exploredPct = Math.floor((exploredCount / Math.max(1, totalCells)) * 100);

  return (
    <div
      data-swipe-exempt="true"
      onClick={requestClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(8, 5, 3, 0.55)",
        backdropFilter: "blur(2px)",
        WebkitBackdropFilter: "blur(2px)",
        display: "grid",
        alignItems: "end",
        pointerEvents: "auto",
        zIndex: 6,
        opacity: phase === "open" ? 1 : 0,
        transition: "opacity 160ms ease-out",
      }}
    >
      <div
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={onSheetPointerDown}
        onPointerMove={onSheetPointerMove}
        onPointerUp={onSheetPointerEnd}
        onPointerCancel={onSheetPointerEnd}
        style={{
          background: "rgba(20, 14, 8, 0.88)",
          backdropFilter: "blur(18px) saturate(1.25)",
          WebkitBackdropFilter: "blur(18px) saturate(1.25)",
          borderTop: `2px solid ${COLORS.border}`,
          padding: "12px 14px 18px",
          maxHeight: "78vh",
          overflowY: "auto",
          boxSizing: "border-box",
          transform: phase === "open" ? "translateY(0)" : "translateY(14px)",
          transition: "transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1)",
          willChange: "transform",
          touchAction: "pan-y",
          boxShadow: `0 -8px 24px rgba(0, 0, 0, 0.6), 0 0 32px ${COLORS.primaryGlow}`,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            marginBottom: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>🗺</span>
            <span style={{ fontFamily: FONTS.display, fontSize: 11, letterSpacing: "0.16em" }}>
              {t("map.title")}
            </span>
          </div>
          <button
            onClick={requestClose}
            style={{
              ...pixelChip,
              fontFamily: FONTS.display,
              fontSize: 8,
              letterSpacing: "0.18em",
              padding: "6px 10px",
            }}
          >
            ✕ {t("map.close")}
          </button>
        </div>

        <div
          style={{
            ...sectionLabel,
            color: COLORS.textMuted,
            marginBottom: 10,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
          }}
        >
          <span>{t("hud.floorLabel")} {state.currentFloor.index + 1}</span>
          <span>{t("map.exploredFmt", { percent: exploredPct })}</span>
        </div>

        <MapCanvas state={state} />

        <Legend />
      </div>
    </div>
  );
}

/** Minimap palette — pulled out so the legend uses the same swatches. */
const MAP_COLORS = {
  bg: "#08050d",
  fog: "rgba(232, 200, 140, 0.04)", // very faint warm tint to suggest "the dungeon is somewhere"
  floor: "#2a3040",
  floorBorder: "rgba(232, 200, 140, 0.08)",
  wall: "#3a2c1d",
  wallTop: "rgba(232, 200, 140, 0.18)",
  voidTile: "#06070b",
  exit: COLORS.primary,
  key: "#d4b76a",
  hero: "#e8a04a",
  heroOutline: "#fff7d6",
} as const;

function MapCanvas({ state }: { state: RunState }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pulsePhase, setPulsePhase] = useState(0);
  const grid = state.currentFloor.grid;

  // Hero pulse animation — drives a single sin wave so the canvas redraws
  // smoothly. ~60fps with no per-cell mutations.
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = () => {
      setPulsePhase((performance.now() - start) / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const cnv = canvasRef.current;
    const container = containerRef.current;
    if (!cnv || !container) return;

    // Fit the canvas to the container width while keeping cells square and
    // capping at a comfortable cell size for mobile glanceability.
    const containerW = container.clientWidth;
    const maxCellPx = 22;
    const cellPx = Math.max(8, Math.min(maxCellPx, Math.floor(containerW / Math.max(grid.width, grid.height))));
    const padding = 4;
    const canvasW = grid.width * cellPx + padding * 2;
    const canvasH = grid.height * cellPx + padding * 2;
    const dpr = window.devicePixelRatio || 1;

    cnv.width = canvasW * dpr;
    cnv.height = canvasH * dpr;
    cnv.style.width = `${canvasW}px`;
    cnv.style.height = `${canvasH}px`;

    const ctx = cnv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    drawMap(ctx, state, cellPx, padding, pulsePhase);
  }, [state, pulsePhase, grid.width, grid.height]);

  return (
    <div
      ref={containerRef}
      style={{
        display: "grid",
        placeItems: "center",
        background: MAP_COLORS.bg,
        border: `1px solid ${COLORS.borderSubtle}`,
        padding: 8,
        marginBottom: 12,
      }}
    >
      <canvas ref={canvasRef} style={{ display: "block" }} />
    </div>
  );
}

function drawMap(
  ctx: CanvasRenderingContext2D,
  state: RunState,
  cellPx: number,
  padding: number,
  pulsePhase: number,
): void {
  const grid = state.currentFloor.grid;
  const explored = state.currentFloor.explored;
  const hero = state.hero.position;
  const exit = state.currentFloor.exitCell;
  const exitUnlocked = state.currentFloor.exitUnlocked;
  const keyCell = findKeyCell(state);

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = MAP_COLORS.bg;
  ctx.fillRect(0, 0, grid.width * cellPx + padding * 2, grid.height * cellPx + padding * 2);

  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const cellX = padding + x * cellPx;
      const cellY = padding + y * cellPx;
      const inset = 0.5;
      const w = cellPx - 1;
      const h = cellPx - 1;
      const isExplored = explored.has(`${x},${y}`);
      const tile = grid.get({ x, y });

      if (!isExplored) {
        // Soft fog — still want the cell shape to feel "there but obscured".
        ctx.fillStyle = MAP_COLORS.fog;
        ctx.fillRect(cellX + inset, cellY + inset, w, h);
        continue;
      }

      // Explored — paint by tile kind.
      if (tile.kind === "wall") {
        ctx.fillStyle = MAP_COLORS.wall;
        ctx.fillRect(cellX + inset, cellY + inset, w, h);
        ctx.fillStyle = MAP_COLORS.wallTop;
        ctx.fillRect(cellX + inset, cellY + inset, w, Math.max(1, Math.floor(cellPx * 0.18)));
        continue;
      }
      if (tile.kind === "void") {
        ctx.fillStyle = MAP_COLORS.voidTile;
        ctx.fillRect(cellX + inset, cellY + inset, w, h);
        continue;
      }
      // Floor / rune / enemy / etc.
      ctx.fillStyle = MAP_COLORS.floor;
      ctx.fillRect(cellX + inset, cellY + inset, w, h);
      ctx.fillStyle = MAP_COLORS.floorBorder;
      ctx.fillRect(cellX + inset, cellY + inset, w, 1);
    }
  }

  // Markers — drawn after base cells so they sit on top.
  if (explored.has(`${exit.x},${exit.y}`)) {
    drawDoorMarker(ctx, padding + exit.x * cellPx, padding + exit.y * cellPx, cellPx, exitUnlocked);
  }
  // Key shows whenever it exists in the world — even through fog. Per design,
  // it represents memory of an item the player needs to retrieve.
  if (keyCell) {
    drawKeyMarker(ctx, padding + keyCell.x * cellPx, padding + keyCell.y * cellPx, cellPx);
  }

  drawHeroMarker(
    ctx,
    padding + hero.x * cellPx,
    padding + hero.y * cellPx,
    cellPx,
    pulsePhase,
  );
}

function drawDoorMarker(
  ctx: CanvasRenderingContext2D,
  cellX: number,
  cellY: number,
  cellPx: number,
  unlocked: boolean,
): void {
  const cx = cellX + cellPx / 2;
  const cy = cellY + cellPx / 2;
  const w = Math.max(3, Math.floor(cellPx * 0.55));
  const h = Math.max(4, Math.floor(cellPx * 0.7));
  ctx.fillStyle = unlocked ? MAP_COLORS.exit : "#8a4a4d";
  ctx.fillRect(Math.floor(cx - w / 2), Math.floor(cy - h / 2), w, h);
  // Small inner notch — door knob hint
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(Math.floor(cx + w / 4) - 1, Math.floor(cy), 2, 2);
}

function drawKeyMarker(
  ctx: CanvasRenderingContext2D,
  cellX: number,
  cellY: number,
  cellPx: number,
): void {
  const cx = cellX + cellPx / 2;
  const cy = cellY + cellPx / 2;
  const r = Math.max(2, Math.floor(cellPx * 0.18));
  // Tiny key: a circle (head) + a short rect (shaft). All at 1-2px scale.
  ctx.fillStyle = MAP_COLORS.key;
  ctx.beginPath();
  ctx.arc(Math.floor(cx - r), Math.floor(cy), r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(Math.floor(cx - r) + 1, Math.floor(cy) - 1, Math.max(2, Math.floor(cellPx * 0.45)), 2);
}

function drawHeroMarker(
  ctx: CanvasRenderingContext2D,
  cellX: number,
  cellY: number,
  cellPx: number,
  pulsePhase: number,
): void {
  const cx = cellX + cellPx / 2;
  const cy = cellY + cellPx / 2;
  const baseR = Math.max(2, Math.floor(cellPx * 0.32));
  const pulse = (Math.sin(pulsePhase * Math.PI * 1.6) + 1) / 2; // 0..1
  const haloR = baseR + 2 + pulse * 4;

  // Outer halo — torchlight pulse
  ctx.globalAlpha = 0.16 + pulse * 0.18;
  ctx.fillStyle = MAP_COLORS.hero;
  ctx.beginPath();
  ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.fillStyle = MAP_COLORS.hero;
  ctx.beginPath();
  ctx.arc(cx, cy, baseR, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = MAP_COLORS.heroOutline;
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(1, baseR - 1.5), 0, Math.PI * 2);
  ctx.fill();
}

function findKeyCell(state: RunState): Cell | null {
  const grid = state.currentFloor.grid;
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (grid.get({ x, y }).kind === "key") return { x, y };
    }
  }
  return null;
}

// Avoid an unused-import warning when the engine ships cellEq via this file's
// module path elsewhere; the renderer imports it directly.
void cellEq;

function Legend() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(98px, 1fr))",
        gap: 8,
        fontFamily: FONTS.body,
        fontSize: 12,
        color: COLORS.textMuted,
      }}
    >
      <LegendItem swatchColor={MAP_COLORS.hero} label={t("map.legend.you")} round />
      <LegendItem swatchColor={MAP_COLORS.exit} label={t("map.legend.exit")} />
      <LegendItem swatchColor={MAP_COLORS.key} label={t("map.legend.key")} round />
      <LegendItem swatchColor={MAP_COLORS.wall} label={t("map.legend.wall")} />
      <LegendItem swatchColor="rgba(232, 200, 140, 0.12)" label={t("map.legend.unexplored")} />
    </div>
  );
}

function LegendItem({
  swatchColor,
  label,
  round,
}: {
  swatchColor: string;
  label: string;
  round?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span
        aria-hidden="true"
        style={{
          width: 10,
          height: 10,
          background: swatchColor,
          borderRadius: round ? "50%" : 0,
          border: `1px solid ${COLORS.borderSubtle}`,
          flexShrink: 0,
        }}
      />
      <span>{label}</span>
    </div>
  );
}
