import { useEffect, useRef, useState } from "react";
import { xpToNextLevel, type ItemKind, type Rune } from "@gridlore/engine";
import { useRunStore } from "../state/store.js";
import { subscribeLocaleChange, t, tRune } from "../i18n.js";
import { useWebHaptics } from "web-haptics/react";
import {
  COLORS,
  FONTS,
  displayHeading,
  pixelBorder,
  pixelButtonGhost,
  pixelButtonPrimary,
  pixelChip,
  sectionLabel,
} from "../theme.js";
import { RUNE_COLORS } from "../pixi/palette.js";

function runeColorCss(rune: Rune): string {
  const n = RUNE_COLORS[rune] ?? 0xffffff;
  return `#${n.toString(16).padStart(6, "0")}`;
}

function hexToRgba(hex: string, alpha: number): string {
  const raw = hex.startsWith("#") ? hex.slice(1) : hex;
  if (raw.length !== 6) return `rgba(255,255,255,${alpha})`;
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function tItemKind(kind: ItemKind): string {
  switch (kind) {
    case "sword":
      return t("inventory.sword");
    case "staff":
      return t("inventory.staff");
    default:
      return String(kind);
  }
}

export function HUD({
  playerName,
  onTryAgain,
  onMainMenu,
}: {
  playerName: string;
  onTryAgain: () => void;
  onMainMenu: () => void;
}) {
  const [, bump] = useState(0);
  const state = useRunStore((s) => s.state);
  const usePotion = useRunStore((s) => s.usePotion);
  const equipWeapon = useRunStore((s) => s.equipWeapon);
  const dropItem = useRunStore((s) => s.dropItem);
  const { trigger } = useWebHaptics();
  const events = useRunStore((s) => s.lastEvents);
  const lastEvent = pickPrimaryEvent(events);
  const [invOpen, setInvOpen] = useState(false);
  const ignoreInvClickRef = useRef(false);
  const bagSwipeRef = useRef<{ pointerId: number; startX: number; startY: number; active: boolean } | null>(null);

  const { hero, currentFloor, meta, turn, outcome } = state;
  const lattices = currentFloor.lattices;
  const chargedCount = Array.from(lattices.byId.values()).filter((l) => l.isCharged).length;
  const totalLattices = lattices.byId.size;
  const lastKeystone = [...events].reverse().find((e) => e.type === "KEYSTONE_BONUS");
  const lastKeystoneColor =
    lastKeystone && lastKeystone.type === "KEYSTONE_BONUS" ? runeColorCss(lastKeystone.keystone) : null;

  useEffect(() => subscribeLocaleChange(() => bump((x) => x + 1)), []);
  useEffect(() => {
    const onToggle = () => setInvOpen((v) => !v);
    window.addEventListener("ui:toggleInventory", onToggle);
    return () => window.removeEventListener("ui:toggleInventory", onToggle);
  }, []);

  function openInventory() {
    setInvOpen(true);
  }
  function closeInventory() {
    setInvOpen(false);
  }

  function onBagPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.pointerType === "mouse") return;
    if (bagSwipeRef.current?.active) return;
    bagSwipeRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, active: true };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  }
  function onBagPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const s = bagSwipeRef.current;
    if (!s || !s.active || s.pointerId !== e.pointerId) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    const MIN_UP_PX = 22;
    const MAX_SLOP_PX = 48;
    if (dy < -MIN_UP_PX && Math.abs(dx) <= MAX_SLOP_PX) {
      ignoreInvClickRef.current = true;
      bagSwipeRef.current = null;
      e.preventDefault();
      openInventory();
    }
  }
  function onBagPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    const s = bagSwipeRef.current;
    if (!s || s.pointerId !== e.pointerId) return;
    bagSwipeRef.current = null;
  }
  function onBagClick() {
    if (ignoreInvClickRef.current) {
      ignoreInvClickRef.current = false;
      return;
    }
    openInventory();
  }

  function hapticsOn(): boolean {
    try {
      const raw = localStorage.getItem("gridlore:hapticsEnabled");
      if (raw == null) return true;
      if (raw === "1" || raw === "true") return true;
      if (raw === "0" || raw === "false") return false;
      return true;
    } catch {
      return true;
    }
  }

  function onUsePotion() {
    const ok = usePotion();
    if (ok && hapticsOn()) {
      trigger([
        { duration: 30 },
        { delay: 60, duration: 40, intensity: 1 },
      ]);
    }
  }

  return (
    // Outer wrapper has NO backdrop-filter so it doesn't become a containing
    // block for fixed-positioned overlays (run-over modal, inventory sheet).
    // The glass effect lives on the absolute sibling div below.
    <div
      style={{
        position: "relative",
        flexShrink: 0,
        fontFamily: FONTS.body,
        fontSize: 14,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(14, 10, 8, 0.6)",
          backdropFilter: "blur(8px) saturate(1.1)",
          WebkitBackdropFilter: "blur(8px) saturate(1.1)",
          borderTop: `1px solid ${COLORS.borderSubtle}`,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          padding: "10px 12px 8px",
        }}
      >
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 6,
          flexWrap: "nowrap",
          overflow: "hidden",
        }}
      >
        <StatChip color={COLORS.heart} icon="♥" value={`${hero.hp}/${hero.hpMax}`} />
        <StatChip color={COLORS.accent} icon="◆" value={`${hero.focus}/${hero.focusMax}`} />
        <StatChip color={COLORS.text} icon="🛡" value={`${hero.armor}`} />
        <StatChip color={COLORS.textMuted} icon={t("hud.turnAbbr")} value={`${turn}`} mono />
        <StatChip color={COLORS.win} icon="⚡" value={`${chargedCount}/${totalLattices}`} />
      </div>

      <div
        style={{
          height: 24,
          color: lastKeystoneColor ?? COLORS.win,
          background: lastKeystoneColor ? hexToRgba(lastKeystoneColor, 0.12) : "transparent",
          ...pixelBorder(lastKeystoneColor ?? "transparent", 1),
          padding: "3px 8px",
          textAlign: "center",
          fontSize: 12,
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
          boxSizing: "border-box",
          lineHeight: "18px",
        }}
      >
        {lastKeystone && lastKeystone.type === "KEYSTONE_BONUS" ? formatEvent(lastKeystone) : " "}
      </div>

      <div
        style={{
          color: COLORS.textMuted,
          height: 18,
          lineHeight: "18px",
          textAlign: "center",
          fontSize: 13,
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
        }}
      >
        {outcome === "in_progress"
          ? lastEvent
            ? formatEvent(lastEvent)
            : state.currentFloor.exitUnlocked
              ? t("hud.guide.exitUnlocked")
              : t("hud.guide.exitLocked")
          : t("hud.runEnded", {
              outcome: t(`outcome.${outcome}`),
              newRun: t("hud.newRun"),
            })}
      </div>

      <div
        data-swipe-exempt="true"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 4,
          padding: "10px 10px 2px",
          borderTop: `1px solid ${COLORS.divider}`,
          fontFamily: FONTS.body,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 180, flex: 1 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
            {playerName.trim() !== "" && (
              <div style={{ ...sectionLabel, color: COLORS.textMuted, fontSize: 8 }}>{playerName}</div>
            )}
            <div
              style={{
                fontFamily: FONTS.display,
                fontSize: 11,
                letterSpacing: "0.14em",
                color: COLORS.text,
              }}
            >
              {t("hud.levelLabel")} {hero.level}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ ...sectionLabel, color: COLORS.textMuted, width: 24, fontSize: 8 }}>
              {t("hud.xpLabel")}
            </div>
            <div
              style={{
                flex: 1,
                height: 10,
                background: COLORS.bgSunkenSolid,
                ...pixelBorder(COLORS.borderSubtle, 1),
                overflow: "hidden",
              }}
              title={`${hero.xp}/${xpToNextLevel(hero.level)}`}
            >
              <div
                style={{
                  width: `${Math.round((hero.xp / xpToNextLevel(hero.level)) * 100)}%`,
                  height: "100%",
                  background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.win})`,
                }}
              />
            </div>
            <div
              style={{
                fontFamily: FONTS.mono,
                fontSize: 11,
                color: COLORS.textMuted,
                textAlign: "right",
                minWidth: 36,
              }}
            >
              {hero.xp}/{xpToNextLevel(hero.level)}
            </div>
          </div>
        </div>
        <button
          onClick={onBagClick}
          onPointerDown={onBagPointerDown}
          onPointerMove={onBagPointerMove}
          onPointerUp={onBagPointerUp}
          onPointerCancel={onBagPointerUp}
          style={{
            ...pixelChip,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            fontFamily: FONTS.display,
            fontSize: 10,
            letterSpacing: "0.16em",
            cursor: "pointer",
            touchAction: "none",
            marginLeft: 10,
          }}
          title={t("inventory.open")}
        >
          <span style={{ fontSize: 18, letterSpacing: 0 }}>🎒</span>
          <span>{t("inventory.title")}</span>
        </button>
      </div>
      </div>

      {outcome === "win" && (
        <RunOverOverlay
          tone="win"
          stats={{ floor: currentFloor.index + 1, score: meta.score, turn, level: hero.level }}
          onTryAgain={onTryAgain}
          onMainMenu={onMainMenu}
        />
      )}
      {outcome === "death" && (
        <RunOverOverlay
          tone="death"
          stats={{ floor: currentFloor.index + 1, score: meta.score, turn, level: hero.level }}
          onTryAgain={onTryAgain}
          onMainMenu={onMainMenu}
        />
      )}

      {invOpen && (
        <InventorySheet
          hero={hero}
          gold={meta.gold}
          onClose={closeInventory}
          onUsePotion={onUsePotion}
          onEquipWeapon={equipWeapon}
          onDropItem={dropItem}
        />
      )}
    </div>
  );
}

function StatChip({
  color,
  icon,
  value,
  mono,
}: {
  color: string;
  icon: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <span
      style={{
        ...pixelChip,
        padding: "4px 8px",
        fontSize: 12,
        letterSpacing: 0,
        gap: 6,
        textTransform: "none",
      }}
    >
      <span style={{ color, fontFamily: mono ? FONTS.mono : FONTS.body }}>{icon}</span>
      <span style={{ color: COLORS.text, fontFamily: FONTS.mono }}>{value}</span>
    </span>
  );
}

function InventorySheet({
  hero,
  gold,
  onClose,
  onUsePotion,
  onEquipWeapon,
  onDropItem,
}: {
  hero: ReturnType<typeof useRunStore.getState>["state"]["hero"];
  gold: number;
  onClose: () => void;
  onUsePotion: () => void;
  onEquipWeapon: (itemId: string | null) => boolean;
  onDropItem: (itemId: string) => boolean;
}) {
  const canUsePotion = hero.potions > 0 && hero.hp < hero.hpMax;
  const GRID_COLS = 4;
  const GRID_ROWS = 3;
  const items: Array<
    | { kind: "weapon"; id: string }
    | { kind: "leaf"; id: string }
    | { kind: "potion"; id: string }
  > = [];
  for (const it of hero.items) {
    if (it.kind === "sword" || it.kind === "staff") items.push({ kind: "weapon", id: it.id });
  }
  for (let i = 0; i < hero.potions; i++) items.push({ kind: "potion", id: `potion-${i}` });
  for (let i = 0; i < hero.brambleProgress; i++) items.push({ kind: "leaf", id: `leaf-${i}` });
  const [phase, setPhase] = useState<"enter" | "open" | "exit">("enter");
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const swipeCloseRef = useRef<{ pointerId: number; startX: number; startY: number; startScrollTop: number } | null>(null);
  const [movingItemId, setMovingItemId] = useState<string | null>(null);
  const [dropConfirmItemId, setDropConfirmItemId] = useState<string | null>(null);
  const BAG_LAYOUT_KEY = "gridlore:bagLayout:v1";
  const BAG_PINNED_KEY = "gridlore:bagPinned:v1";
  const [layout, setLayout] = useState<Record<string, { x: number; y: number }>>(() => {
    try {
      const raw = localStorage.getItem(BAG_LAYOUT_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object") return {};
      return parsed as Record<string, { x: number; y: number }>;
    } catch {
      return {};
    }
  });
  const [pinned, setPinned] = useState<Record<string, true>>(() => {
    try {
      const raw = localStorage.getItem(BAG_PINNED_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return {};
      const out: Record<string, true> = {};
      for (const v of parsed) {
        if (typeof v === "string" && v.trim() !== "") out[v] = true;
      }
      return out;
    } catch {
      return {};
    }
  });

  useEffect(() => {
    const raf = requestAnimationFrame(() => setPhase("open"));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(BAG_LAYOUT_KEY, JSON.stringify(layout));
    } catch {}
  }, [layout]);
  useEffect(() => {
    try {
      localStorage.setItem(BAG_PINNED_KEY, JSON.stringify(Object.keys(pinned)));
    } catch {}
  }, [pinned]);

  function requestClose() {
    if (phase === "exit") return;
    setPhase("exit");
    window.setTimeout(() => onClose(), 170);
  }

  function droppableWeaponId(id: string | null): string | null {
    if (!id) return null;
    const item = hero.items.find((it) => it.id === id);
    if (!item) return null;
    if (item.kind !== "sword" && item.kind !== "staff") return null;
    return id;
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

  type Placement = { id: string; kind: "weapon" | "leaf" | "potion"; x: number; y: number; w: number; h: number };
  const occupied = Array.from({ length: GRID_ROWS }, () => Array.from({ length: GRID_COLS }, () => false));
  const placements: Placement[] = [];

  function weaponDims(kind: "sword" | "staff"): { w: number; h: number } {
    if (kind === "sword") return { w: 1, h: 2 };
    return { w: 2, h: 1 };
  }

  function itemDims(id: string): { w: number; h: number } | null {
    if (id.startsWith("leaf-") || id.startsWith("potion-")) return { w: 1, h: 1 };
    const item = hero.items.find((it) => it.id === id);
    if (!item || (item.kind !== "sword" && item.kind !== "staff")) return null;
    return weaponDims(item.kind);
  }

  function canPlace(x: number, y: number, w: number, h: number): boolean {
    if (x < 0 || y < 0 || x + w > GRID_COLS || y + h > GRID_ROWS) return false;
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        if (occupied[yy]![xx]!) return false;
      }
    }
    return true;
  }

  function place(id: string, kind: Placement["kind"], x: number, y: number, w: number, h: number) {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) occupied[yy]![xx] = true;
    }
    placements.push({ id, kind, x, y, w, h });
  }

  function firstFit(w: number, h: number): { x: number; y: number } | null {
    for (let y = 0; y < GRID_ROWS; y++) {
      for (let x = 0; x < GRID_COLS; x++) {
        if (canPlace(x, y, w, h)) return { x, y };
      }
    }
    return null;
  }

  const nextLayout: Record<string, { x: number; y: number }> = {};
  for (const it of items) {
    const dims = itemDims(it.id);
    if (!dims) continue;
    const allowPreferred = it.kind === "weapon" || pinned[it.id] === true;
    const preferred = allowPreferred ? layout[it.id] : undefined;
    if (preferred && canPlace(preferred.x, preferred.y, dims.w, dims.h)) {
      nextLayout[it.id] = preferred;
      place(it.id, it.kind, preferred.x, preferred.y, dims.w, dims.h);
      continue;
    }
    const spot = firstFit(dims.w, dims.h);
    if (!spot) continue;
    nextLayout[it.id] = spot;
    place(it.id, it.kind, spot.x, spot.y, dims.w, dims.h);
  }

  function layoutsEqual(
    a: Record<string, { x: number; y: number }>,
    b: Record<string, { x: number; y: number }>,
  ): boolean {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    for (const k of aKeys) {
      const av = a[k];
      if (av === undefined) return false;
      const bv = b[k];
      if (bv === undefined) return false;
      if (av.x !== bv.x || av.y !== bv.y) return false;
    }
    return true;
  }

  useEffect(() => {
    if (!layoutsEqual(layout, nextLayout)) setLayout(nextLayout);
  }, [hero.items, hero.brambleProgress, hero.potions]);

  function requestMoveToCell(x: number, y: number) {
    const id = movingItemId;
    if (!id) return;
    const dims = itemDims(id);
    if (!dims) return;

    const current = placements.find((p) => p.id === id);
    const tmpOccupied = Array.from({ length: GRID_ROWS }, (_, yy) =>
      Array.from({ length: GRID_COLS }, (_, xx) => occupied[yy]![xx]!),
    );
    if (current) {
      for (let yy = current.y; yy < current.y + current.h; yy++) {
        for (let xx = current.x; xx < current.x + current.w; xx++) tmpOccupied[yy]![xx] = false;
      }
    }
    if (x < 0 || y < 0 || x + dims.w > GRID_COLS || y + dims.h > GRID_ROWS) return;
    for (let yy = y; yy < y + dims.h; yy++) {
      for (let xx = x; xx < x + dims.w; xx++) {
        if (tmpOccupied[yy]![xx]!) return;
      }
    }
    setLayout((prev) => ({ ...prev, [id]: { x, y } }));
    setPinned((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
    setMovingItemId(null);
  }

  const movingDims = movingItemId ? itemDims(movingItemId) : null;
  const movingCurrent = movingItemId ? placements.find((p) => p.id === movingItemId) : null;
  const movingOccupied = movingItemId
    ? Array.from({ length: GRID_ROWS }, (_, yy) =>
        Array.from({ length: GRID_COLS }, (_, xx) => occupied[yy]![xx]!),
      )
    : null;
  if (movingItemId && movingOccupied && movingCurrent) {
    for (let yy = movingCurrent.y; yy < movingCurrent.y + movingCurrent.h; yy++) {
      for (let xx = movingCurrent.x; xx < movingCurrent.x + movingCurrent.w; xx++) movingOccupied[yy]![xx] = false;
    }
  }
  function canDropAtCell(x: number, y: number): boolean {
    if (!movingItemId || !movingDims || !movingOccupied) return false;
    if (x < 0 || y < 0 || x + movingDims.w > GRID_COLS || y + movingDims.h > GRID_ROWS) return false;
    for (let yy = y; yy < y + movingDims.h; yy++) {
      for (let xx = x; xx < x + movingDims.w; xx++) {
        if (movingOccupied[yy]![xx]!) return false;
      }
    }
    return true;
  }

  return (
    <div
      data-swipe-exempt="true"
      onClick={() => {
        const id = droppableWeaponId(movingItemId);
        if (id) {
          setDropConfirmItemId(id);
          return;
        }
        requestClose();
      }}
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
          background: "rgba(20, 14, 8, 0.85)",
          backdropFilter: "blur(18px) saturate(1.25)",
          WebkitBackdropFilter: "blur(18px) saturate(1.25)",
          borderTop: `2px solid ${COLORS.border}`,
          padding: "12px 14px 16px",
          maxHeight: "70vh",
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
            marginBottom: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>🎒</span>
            <span style={{ fontFamily: FONTS.display, fontSize: 11, letterSpacing: "0.16em" }}>
              {t("inventory.title")}
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
            ✕ {t("inventory.close")}
          </button>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 12,
            marginBottom: 12,
            color: COLORS.textMuted,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 16, lineHeight: "16px" }}>🪙</span>
            <span style={{ ...sectionLabel, fontSize: 8 }}>{t("inventory.coins")}</span>
            <span style={{ fontFamily: FONTS.mono, fontSize: 16, color: COLORS.text }}>{gold}</span>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${GRID_ROWS}, minmax(0, 1fr))`,
            gap: 0,
          }}
        >
          {Array.from({ length: GRID_ROWS }).flatMap((_, y) =>
            Array.from({ length: GRID_COLS }).map((_, x) => (
              (() => {
                const dropAllowed = movingItemId ? canDropAtCell(x, y) : false;
                return (
              <InventorySlotEmpty
                key={`cell-${x}-${y}`}
                onClick={dropAllowed ? () => requestMoveToCell(x, y) : undefined}
                dropAllowed={dropAllowed}
                x={x}
                y={y}
              />
                );
              })()
            )),
          )}
          {placements.map((p) => {
            if (p.kind === "weapon") {
              const item = hero.items.find((it) => it.id === p.id);
              if (!item) return null;
              const equipped = hero.equippedWeaponId === p.id;
              return (
                <InventorySlotWeapon
                  key={`weapon-${p.id}`}
                  item={item}
                  equipped={equipped}
                  moving={movingItemId === p.id}
                  moveModeActive={movingItemId !== null}
                  onStartMove={() => setMovingItemId((cur) => (cur === p.id ? null : p.id))}
                  onToggleEquip={() => onEquipWeapon(equipped ? null : p.id)}
                  x={p.x}
                  y={p.y}
                  w={p.w}
                  h={p.h}
                />
              );
            }
            if (p.kind === "leaf") {
              return (
                <InventorySlotItem
                  key={p.id}
                  icon="🌿"
                  label={t("inventory.leaf")}
                  moving={movingItemId === p.id}
                  moveModeActive={movingItemId !== null}
                  onStartMove={() => setMovingItemId((cur) => (cur === p.id ? null : p.id))}
                  x={p.x}
                  y={p.y}
                />
              );
            }
            return (
              <InventorySlotPotion
                key={p.id}
                onClick={onUsePotion}
                disabled={!canUsePotion}
                highlight={canUsePotion}
                label={t("inventory.potion")}
                tooltip={t("inventory.potionHint", { potions: hero.potions })}
                moving={movingItemId === p.id}
                moveModeActive={movingItemId !== null}
                onStartMove={() => setMovingItemId((cur) => (cur === p.id ? null : p.id))}
                x={p.x}
                y={p.y}
              />
            );
          })}
        </div>
      </div>
      {dropConfirmItemId && (
        <div
          onClick={() => setDropConfirmItemId(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(8, 5, 3, 0.7)",
            backdropFilter: "blur(6px) saturate(0.9)",
            WebkitBackdropFilter: "blur(6px) saturate(0.9)",
            display: "grid",
            placeItems: "center",
            zIndex: 7,
            padding: 18,
            boxSizing: "border-box",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(420px, 100%)",
              background: "rgba(20, 14, 8, 0.88)",
              backdropFilter: "blur(18px) saturate(1.25)",
              WebkitBackdropFilter: "blur(18px) saturate(1.25)",
              ...pixelBorder(COLORS.death, 2),
              padding: "18px 18px 16px",
              textAlign: "center",
              color: COLORS.text,
              boxShadow: `0 0 0 4px rgba(0, 0, 0, 0.4), 0 0 34px rgba(196, 88, 90, 0.35)`,
            }}
          >
            <div style={{ fontSize: 34, lineHeight: "34px", marginBottom: 8 }}>🗑</div>
            <div style={{ ...sectionLabel, color: COLORS.death }}>{t("inventory.dropTitle")}</div>
            <div style={{ marginTop: 10, fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted }}>
              {t("inventory.dropConfirm")}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 16, flexWrap: "wrap" }}>
              <button onClick={() => setDropConfirmItemId(null)} style={{ ...pixelButtonGhost, padding: "10px 16px" }}>
                {t("inventory.dropCancel")}
              </button>
              <button
                onClick={() => {
                  onDropItem(dropConfirmItemId);
                  setMovingItemId(null);
                  setDropConfirmItemId(null);
                }}
                style={{ ...pixelButtonPrimary, fontSize: 11 }}
              >
                {t("inventory.dropConfirmYes")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function inventorySlotBaseStyle(): React.CSSProperties {
  return {
    display: "grid",
    gap: 4,
    placeItems: "center",
    ...pixelBorder(COLORS.borderDim, 1),
    padding: 0,
    background: "rgba(8, 5, 3, 0.32)",
    minHeight: 74,
    boxSizing: "border-box",
  };
}

function InventorySlotItem({
  icon,
  label,
  moving,
  moveModeActive,
  onStartMove,
  x,
  y,
}: {
  icon: string;
  label: string;
  moving: boolean;
  moveModeActive: boolean;
  onStartMove: () => void;
  x: number;
  y: number;
}) {
  const longPressRef = useRef<number | null>(null);
  const ignoreClickRef = useRef(false);
  return (
    <button
      onContextMenu={(e) => {
        e.preventDefault();
        onStartMove();
      }}
      onPointerDown={(e) => {
        if (e.pointerType === "mouse") return;
        ignoreClickRef.current = false;
        if (longPressRef.current != null) window.clearTimeout(longPressRef.current);
        longPressRef.current = window.setTimeout(() => {
          ignoreClickRef.current = true;
          onStartMove();
        }, 260);
      }}
      onPointerUp={() => {
        if (longPressRef.current != null) window.clearTimeout(longPressRef.current);
        longPressRef.current = null;
      }}
      onPointerCancel={() => {
        if (longPressRef.current != null) window.clearTimeout(longPressRef.current);
        longPressRef.current = null;
      }}
      onClick={() => {
        if (ignoreClickRef.current) return;
        if (moveModeActive) onStartMove();
      }}
      style={{
        ...inventorySlotBaseStyle(),
        background: "transparent",
        color: COLORS.text,
        ...pixelBorder(moving ? COLORS.primary : COLORS.borderDim, moving ? 2 : 1),
        gridColumnStart: x + 1,
        gridRowStart: y + 1,
        zIndex: 1,
        cursor: "pointer",
        fontFamily: FONTS.body,
      }}
      title={label}
    >
      <div style={{ fontSize: 24, lineHeight: "24px" }}>{icon}</div>
      <div style={{ ...sectionLabel, fontSize: 8 }}>{label}</div>
    </button>
  );
}

function InventorySlotWeapon({
  item,
  equipped,
  moving,
  moveModeActive,
  onStartMove,
  onToggleEquip,
  x,
  y,
  w,
  h,
}: {
  item: ReturnType<typeof useRunStore.getState>["state"]["hero"]["items"][number];
  equipped: boolean;
  moving: boolean;
  moveModeActive: boolean;
  onStartMove: () => void;
  onToggleEquip: () => void;
  x: number;
  y: number;
  w: number;
  h: number;
}) {
  const isSword = item.kind === "sword";
  const icon = isSword ? "🗡" : "🪄";
  const label = isSword ? t("inventory.sword") : t("inventory.staff");
  const bonus = "attackBonus" in item ? item.attackBonus : 0;
  const durability = "durability" in item ? `${item.durability}/${item.durabilityMax}` : "";
  const longPressRef = useRef<number | null>(null);
  const ignoreClickRef = useRef(false);
  return (
    <button
      onContextMenu={(e) => {
        e.preventDefault();
        onStartMove();
      }}
      onPointerDown={(e) => {
        if (e.pointerType === "mouse") return;
        ignoreClickRef.current = false;
        if (longPressRef.current != null) window.clearTimeout(longPressRef.current);
        longPressRef.current = window.setTimeout(() => {
          ignoreClickRef.current = true;
          onStartMove();
        }, 260);
      }}
      onPointerUp={() => {
        if (longPressRef.current != null) window.clearTimeout(longPressRef.current);
        longPressRef.current = null;
      }}
      onPointerCancel={() => {
        if (longPressRef.current != null) window.clearTimeout(longPressRef.current);
        longPressRef.current = null;
      }}
      onClick={() => {
        if (ignoreClickRef.current) return;
        if (moveModeActive) onStartMove();
        else onToggleEquip();
      }}
      style={{
        ...inventorySlotBaseStyle(),
        background: "rgba(8, 5, 3, 0.92)",
        color: COLORS.text,
        ...pixelBorder(moving ? COLORS.primary : equipped ? COLORS.primary : COLORS.borderDim, moving ? 2 : 1),
        gridColumnStart: x + 1,
        gridRowStart: y + 1,
        gridColumnEnd: `span ${w}`,
        gridRowEnd: `span ${h}`,
        cursor: "pointer",
        fontFamily: FONTS.body,
        position: "relative",
        zIndex: 2,
      }}
      title={label}
    >
      <div style={{ fontSize: 24, lineHeight: "24px" }}>{icon}</div>
      <div style={{ ...sectionLabel, fontSize: 8 }}>{label}</div>
      <div style={{ fontFamily: FONTS.mono, fontSize: 12, color: COLORS.primary }}>{bonus > 0 ? `+${bonus}` : ""}</div>
      {durability !== "" && <div style={{ fontFamily: FONTS.mono, fontSize: 11, opacity: 0.9 }}>{durability}</div>}
      {equipped && (
        <div
          style={{
            position: "absolute",
            top: 4,
            right: 4,
            ...pixelBorder(COLORS.primary, 1),
            background: "rgba(10, 6, 4, 0.75)",
            padding: "3px 4px",
            fontFamily: FONTS.display,
            fontSize: 7,
            letterSpacing: "0.14em",
            color: COLORS.primary,
          }}
        >
          {t("inventory.equipped")}
        </div>
      )}
    </button>
  );
}

function InventorySlotPotion({
  onClick,
  disabled,
  highlight,
  label,
  tooltip,
  moving,
  moveModeActive,
  onStartMove,
  x,
  y,
}: {
  onClick: () => void;
  disabled: boolean;
  highlight: boolean;
  label: string;
  tooltip: string;
  moving: boolean;
  moveModeActive: boolean;
  onStartMove: () => void;
  x: number;
  y: number;
}) {
  const longPressRef = useRef<number | null>(null);
  const ignoreClickRef = useRef(false);
  return (
    <button
      aria-disabled={disabled}
      onContextMenu={(e) => {
        e.preventDefault();
        onStartMove();
      }}
      onPointerDown={(e) => {
        if (e.pointerType === "mouse") return;
        ignoreClickRef.current = false;
        if (longPressRef.current != null) window.clearTimeout(longPressRef.current);
        longPressRef.current = window.setTimeout(() => {
          ignoreClickRef.current = true;
          onStartMove();
        }, 260);
      }}
      onPointerUp={() => {
        if (longPressRef.current != null) window.clearTimeout(longPressRef.current);
        longPressRef.current = null;
      }}
      onPointerCancel={() => {
        if (longPressRef.current != null) window.clearTimeout(longPressRef.current);
        longPressRef.current = null;
      }}
      onClick={() => {
        if (ignoreClickRef.current) return;
        if (moveModeActive) onStartMove();
        else if (!disabled) onClick();
      }}
      style={{
        ...inventorySlotBaseStyle(),
        background: "transparent",
        color: COLORS.text,
        ...pixelBorder(moving ? COLORS.primary : highlight ? COLORS.primary : COLORS.borderDim, moving ? 2 : 1),
        gridColumnStart: x + 1,
        gridRowStart: y + 1,
        zIndex: 1,
        cursor: disabled && !moveModeActive ? "not-allowed" : "pointer",
        opacity: disabled && !moveModeActive ? 0.6 : 1,
        fontFamily: FONTS.body,
      }}
      title={tooltip}
    >
      <div style={{ fontSize: 24, lineHeight: "24px" }}>🧪</div>
      <div style={{ ...sectionLabel, fontSize: 8 }}>{label}</div>
    </button>
  );
}

function InventorySlotEmpty({
  onClick,
  dropAllowed,
  x,
  y,
}: {
  onClick?: () => void;
  dropAllowed?: boolean;
  x: number;
  y: number;
}) {
  return (
    <button
      aria-hidden="true"
      onClick={onClick}
      style={{
        ...inventorySlotBaseStyle(),
        background: "rgba(8, 5, 3, 0.18)",
        opacity: 0.9,
        gridColumnStart: x + 1,
        gridRowStart: y + 1,
        zIndex: 0,
        cursor: onClick ? "pointer" : "default",
        ...pixelBorder(dropAllowed ? "rgba(76, 196, 108, 0.9)" : COLORS.borderDim, 1),
      }}
    />
  );
}

function RunOverOverlay({
  tone,
  stats,
  onTryAgain,
  onMainMenu,
}: {
  tone: "win" | "death";
  stats: { floor: number; score: number; turn: number; level: number };
  onTryAgain: () => void;
  onMainMenu: () => void;
}) {
  const accent = tone === "win" ? COLORS.win : COLORS.death;
  const titleKey = tone === "win" ? "runOver.win" : "runOver.death";
  const icon = tone === "win" ? "⚑" : "🪦";
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(8, 5, 3, 0.7)",
        backdropFilter: "blur(6px) saturate(0.9)",
        WebkitBackdropFilter: "blur(6px) saturate(0.9)",
        display: "grid",
        placeItems: "center",
        pointerEvents: "auto",
        zIndex: 5,
        padding: 18,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "min(440px, 100%)",
          background: "rgba(20, 14, 8, 0.88)",
          backdropFilter: "blur(18px) saturate(1.25)",
          WebkitBackdropFilter: "blur(18px) saturate(1.25)",
          ...pixelBorder(accent, 2),
          padding: "24px 22px 22px",
          textAlign: "center",
          color: COLORS.text,
          boxShadow: `0 0 0 4px rgba(0, 0, 0, 0.4), 0 0 40px ${
            tone === "win" ? "rgba(232, 198, 116, 0.45)" : "rgba(196, 88, 90, 0.45)"
          }`,
        }}
      >
        <div style={{ fontSize: 44, lineHeight: "44px", marginBottom: 6 }}>{icon}</div>
        <div style={{ ...sectionLabel, color: accent }}>{t("runOver.title")}</div>
        <div
          style={{
            ...displayHeading,
            fontSize: 16,
            marginTop: 10,
            textShadow: `0 0 16px ${accent}`,
            color: accent,
            letterSpacing: "0.06em",
          }}
        >
          {t(titleKey)}
        </div>

        <div
          style={{
            marginTop: 18,
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 10,
          }}
        >
          <StatTile label={t("runOver.statFloor")} value={`${stats.floor}`} />
          <StatTile label={t("runOver.statScore")} value={`${stats.score}`} />
          <StatTile label={t("runOver.statLevel")} value={`${stats.level}`} />
          <StatTile label={t("runOver.statTurn")} value={`${stats.turn}`} />
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 22, flexWrap: "wrap" }}>
          <button onClick={onTryAgain} style={{ ...pixelButtonPrimary, fontSize: 11 }}>
            ♥ {t("runOver.again")}
          </button>
          <button onClick={onMainMenu} style={{ ...pixelButtonGhost, padding: "10px 16px" }}>
            ☰ {t("runOver.menu")}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        ...pixelBorder(COLORS.borderSubtle, 1),
        padding: "10px 8px",
        background: "rgba(8, 5, 3, 0.55)",
        display: "grid",
        gap: 4,
        placeItems: "center",
      }}
    >
      <div style={{ ...sectionLabel, fontSize: 8 }}>{label}</div>
      <div style={{ fontFamily: FONTS.display, fontSize: 14, color: COLORS.text }}>{value}</div>
    </div>
  );
}

function pickPrimaryEvent(
  events: ReadonlyArray<NonNullable<ReturnType<typeof useRunStore.getState>["lastEvents"][number]>>,
) {
  const priority: string[] = [
    "INPUT_REJECTED",
    "HERO_DIED",
    "KEY_COLLECTED",
    "KEY_DROPPED",
    "FLOOR_COMPLETED",
    "EXIT_UNLOCKED",
  ];
  for (const p of priority) {
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i]?.type === p) return events[i];
    }
  }
  return events[events.length - 1];
}

function formatEvent(e: NonNullable<ReturnType<typeof useRunStore.getState>["lastEvents"][number]>): string {
  switch (e.type) {
    case "ITEM_SPAWNED":
      return t("event.itemSpawned", { item: tItemKind(e.itemKind), x: e.cell.x, y: e.cell.y });
    case "ITEM_PICKUP_BLOCKED":
      return t("event.itemPickupBlocked", { item: tItemKind(e.itemKind) });
    case "ITEM_PICKED_UP":
      return t("event.itemPickedUp", { item: tItemKind(e.itemKind) });
    case "ITEM_DROPPED":
      return t("event.itemDropped", { item: tItemKind(e.itemKind) });
    case "WEAPON_EQUIPPED":
      return e.itemKind ? t("event.weaponEquipped", { item: tItemKind(e.itemKind) }) : t("event.weaponUnequipped");
    case "WEAPON_BROKE":
      return t("event.weaponBroke", { item: tItemKind(e.itemKind) });
    case "HERO_MOVED":
      return t("event.heroMoved", { x: e.to.x, y: e.to.y });
    case "EXIT_UNLOCKED":
      return t("event.exitUnlocked");
    case "LATTICE_CHARGED":
      return t("event.latticeCharged", { lattice: e.lattice, keystone: tRune(e.keystone) });
    case "LATTICE_DECHARGED":
      return t("event.latticeDecharged", { lattice: e.lattice });
    case "RUNE_SPAWNED":
      return t("event.runeSpawned", { rune: tRune(e.rune), x: e.cell.x, y: e.cell.y });
    case "TILE_RESOLVED":
      return e.rune
        ? t("event.tileResolved.rune", { rune: tRune(e.rune) })
        : t("event.tileResolved.empty");
    case "KEYSTONE_BONUS":
      return formatKeystoneBonus(e);
    case "GOLD_GAINED":
      return t("event.goldGained", { amount: e.amount });
    case "HP_HEALED":
      return t("event.hpHealed", { amount: e.amount });
    case "ARMOR_GAINED":
      return t("event.armorGained", { amount: e.amount });
    case "FOCUS_GAINED":
      return t("event.focusGained", { amount: e.amount });
    case "FLOOR_COMPLETED":
      return t("event.floorCompleted", { floor: e.floorIndex + 1 });
    case "ENEMY_MOVED":
      return t("event.enemyMoved", { x: e.to.x, y: e.to.y });
    case "ENEMY_ATTACKED":
      return t("event.enemyAttacked");
    case "ENEMY_DAMAGED":
      return t("event.enemyDamaged", { hp: e.hpAfter });
    case "ENEMY_KILLED":
      return t("event.enemyKilled");
    case "HERO_LEVELED_UP":
      return t("event.heroLeveledUp", { level: e.level, hpMax: e.hpMax });
    case "POTION_GAINED":
      return t("event.potionGained", { potions: e.potions });
    case "POTION_USED":
      return t("event.potionUsed", { healed: e.healed, potions: e.potions });
    case "KEY_DROPPED":
      return t("event.keyDropped");
    case "KEY_COLLECTED":
      return t("event.keyCollected");
    case "HERO_DAMAGED":
      return t("event.heroDamaged", { amount: e.amount });
    case "HERO_DIED":
      return t("event.heroDied");
    case "DAMAGE_DEALT":
      return "·";
    case "BOMB_EXPLODED":
      return "💥";
    case "INPUT_REJECTED":
      return `× ${formatReject(e)}`;
    case "TURN_STARTED":
      return t("event.turnStarted", { turn: e.turn });
    default: {
      const _exhaustive: never = e;
      return String((_exhaustive as { type?: string })?.type ?? "");
    }
  }
}

function formatReject(
  e: Extract<
    NonNullable<ReturnType<typeof useRunStore.getState>["lastEvents"][number]>,
    { type: "INPUT_REJECTED" }
  >,
): string {
  return t(`reject.${e.reasonKey}`, e.details ?? {});
}

function formatKeystoneBonus(
  e: Extract<
    NonNullable<ReturnType<typeof useRunStore.getState>["lastEvents"][number]>,
    { type: "KEYSTONE_BONUS" }
  >,
): string {
  switch (e.effect.kind) {
    case "tide":
      return t("event.keystoneBonus.tide", { hp: e.effect.hpGained, tide: e.effect.tideOnGrid });
    case "coin":
      return t("event.keystoneBonus.coin", { gold: e.effect.goldGained });
    case "bone":
      return t("event.keystoneBonus.bone", { hp: e.effect.hpGained });
    case "iron":
      return t("event.keystoneBonus.iron", { armor: e.effect.armorGained });
    case "ember":
      return t("event.keystoneBonus.ember", { atk: e.effect.attackGained, total: e.effect.attack });
    case "bramble":
      return t("event.keystoneBonus.bramble", { potions: e.effect.potions });
    case "star":
      return t("event.keystoneBonus.star", { xp: e.effect.xpGained, level: e.effect.level });
    case "void":
      return t("event.keystoneBonus.void", { stride: e.effect.stride });
    case "blood":
      return t("event.keystoneBonus.blood", { hpMax: e.effect.hpMax, healed: e.effect.healed });
    case "pending":
      return t("event.keystoneBonus.pending", { keystone: tRune(e.keystone) });
  }
}
