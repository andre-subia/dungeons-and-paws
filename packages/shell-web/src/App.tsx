import { useCallback, useEffect, useState } from "react";
import { GridView } from "./components/GridView.js";
import { HUD } from "./components/HUD.js";
import { LOCALES, getLocale, setLocale, subscribeLocaleChange, t } from "./i18n.js";
import { useRunStore } from "./state/store.js";
import { useWebHaptics } from "web-haptics/react";
import type { Cell } from "@gridlore/engine";

/** Order of sections rendered in the help modal. Keys mirror i18n. */
const HELP_SECTIONS = [
  "goal",
  "move",
  "cat",
  "runes",
  "lattices",
  "exit",
  "enemies",
  "tips",
] as const;

const ANIM_SPEED_STORAGE_KEY = "gridlore:animSpeed";
const HAPTICS_STORAGE_KEY = "gridlore:hapticsEnabled";

function readAnimSpeed(): number {
  try {
    const raw = localStorage.getItem(ANIM_SPEED_STORAGE_KEY);
    const n = raw == null ? NaN : Number(raw);
    if (!Number.isFinite(n)) return 0.7;
    return Math.max(0.2, Math.min(2, n));
  } catch {
    return 0.7;
  }
}

function readBool(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    if (raw === "1" || raw === "true") return true;
    if (raw === "0" || raw === "false") return false;
    return fallback;
  } catch {
    return fallback;
  }
}

export function App() {
  const [, bump] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [animSpeed, setAnimSpeed] = useState(readAnimSpeed);
  const [hapticsEnabled, setHapticsEnabled] = useState(() => readBool(HAPTICS_STORAGE_KEY, true));
  const { trigger } = useWebHaptics();
  const score = useRunStore((s) => s.state.meta.score);
  const floorIndex = useRunStore((s) => s.state.currentFloor.index);
  useEffect(() => subscribeLocaleChange(() => bump((x) => x + 1)), []);

  const attemptMove = useCallback(
    (to: Cell, source: "tap" | "keyboard") => {
      const store = useRunStore.getState();
      const accepted = store.move(to);
      if (!accepted) return;
      if (!hapticsEnabled) return;

      const events = useRunStore.getState().lastEvents;
      const charged = events.some((e) => e.type === "LATTICE_CHARGED");
      if (charged) {
        trigger([
          { duration: 45, intensity: 0.7 },
          { delay: 70, duration: 55, intensity: 1 },
        ]);
        return;
      }

      const attack = events.some((e) => e.type === "DAMAGE_DEALT");
      if (attack) {
        trigger([{ duration: 35, intensity: 1 }]);
        return;
      }

      if (source === "tap") trigger();
    },
    [hapticsEnabled, trigger],
  );

  const onGridMove = useCallback((cell: Cell) => attemptMove(cell, "tap"), [attemptMove]);

  useEffect(() => {
    const pressed = new Set<"up" | "down" | "left" | "right">();
    const latched = new Set<"up" | "down" | "left" | "right">();
    let pendingMoveTimer: number | null = null;
    const CHORD_MS = 25;

    function isEditableTarget(t: EventTarget | null): boolean {
      if (!t || !(t instanceof HTMLElement)) return false;
      const tag = t.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (t.isContentEditable) return true;
      return false;
    }

    function keyToDir(key: string): "up" | "down" | "left" | "right" | null {
      switch (key) {
        case "ArrowUp":
        case "w":
        case "W":
          return "up";
        case "ArrowDown":
        case "s":
        case "S":
          return "down";
        case "ArrowLeft":
        case "a":
        case "A":
          return "left";
        case "ArrowRight":
        case "d":
        case "D":
          return "right";
        default:
          return null;
      }
    }

    function computeVector(dirs: ReadonlySet<"up" | "down" | "left" | "right">): { dx: number; dy: number } {
      let dx = 0;
      let dy = 0;
      if (dirs.has("left")) dx -= 1;
      if (dirs.has("right")) dx += 1;
      if (dirs.has("up")) dy -= 1;
      if (dirs.has("down")) dy += 1;
      if (dx !== 0) dx = dx > 0 ? 1 : -1;
      if (dy !== 0) dy = dy > 0 ? 1 : -1;
      return { dx, dy };
    }

    function tryMoveFrom(dirs: ReadonlySet<"up" | "down" | "left" | "right">): void {
      const { dx, dy } = computeVector(dirs);
      if (dx === 0 && dy === 0) return;
      const store = useRunStore.getState();
      const state = store.state;
      if (state.outcome !== "in_progress") return;
      const to = { x: state.hero.position.x + dx, y: state.hero.position.y + dy };
      if (!state.currentFloor.grid.inBounds(to)) return;
      attemptMove(to, "keyboard");
    }

    function onKeyDown(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return;

      if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        window.dispatchEvent(new Event("ui:toggleInventory"));
        return;
      }
      if (e.key === "2") {
        e.preventDefault();
        const ok = useRunStore.getState().usePotion();
        if (ok && hapticsEnabled) {
          trigger([
            { duration: 30 },
            { delay: 60, duration: 40, intensity: 1 },
          ]);
        }
        return;
      }

      const dir = keyToDir(e.key);
      if (!dir) return;
      e.preventDefault();
      if (e.repeat) return;
      pressed.add(dir);
      if (pendingMoveTimer == null) {
        latched.clear();
        latched.add(dir);
        pendingMoveTimer = window.setTimeout(() => {
          pendingMoveTimer = null;
          tryMoveFrom(latched);
          latched.clear();
        }, CHORD_MS);
        return;
      }

      latched.add(dir);
      window.clearTimeout(pendingMoveTimer);
      pendingMoveTimer = null;
      tryMoveFrom(latched);
      latched.clear();
    }

    function onKeyUp(e: KeyboardEvent) {
      const dir = keyToDir(e.key);
      if (!dir) return;
      e.preventDefault();
      pressed.delete(dir);
    }

    function onBlur() {
      pressed.clear();
      latched.clear();
      if (pendingMoveTimer != null) {
        window.clearTimeout(pendingMoveTimer);
        pendingMoveTimer = null;
      }
    }

    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp, { passive: false });
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [attemptMove]);

  useEffect(() => {
    const MIN_SWIPE_PX = 24;
    let active:
      | {
          id: number;
          startX: number;
          startY: number;
          lastX: number;
          lastY: number;
          moved: boolean;
          kind: "pointer" | "touch";
        }
      | null = null;

    function isSwipeExemptTarget(t: EventTarget | null): boolean {
      if (!t || !(t instanceof Element)) return false;
      return Boolean(t.closest('[data-swipe-exempt="true"]'));
    }

    function directionFromDelta(dx: number, dy: number): { dx: -1 | 0 | 1; dy: -1 | 0 | 1 } | null {
      if (dx === 0 && dy === 0) return null;
      const angle = Math.atan2(dy, dx);
      const octant = Math.round(angle / (Math.PI / 4));
      const idx = ((octant % 8) + 8) % 8;
      const dirs = [
        { dx: 1, dy: 0 },
        { dx: 1, dy: 1 },
        { dx: 0, dy: 1 },
        { dx: -1, dy: 1 },
        { dx: -1, dy: 0 },
        { dx: -1, dy: -1 },
        { dx: 0, dy: -1 },
        { dx: 1, dy: -1 },
      ] as const;
      return dirs[idx] ?? null;
    }

    function handleEnd(dx: number, dy: number, prevent: () => void) {
      const moved = Math.hypot(dx, dy) >= MIN_SWIPE_PX;
      console.log("[swipe] end", { dx, dy, moved });
      if (!moved) return;

      const dir = directionFromDelta(dx, dy);
      console.log("[swipe] dir", dir);
      if (!dir || (dir.dx === 0 && dir.dy === 0)) return;

      const store = useRunStore.getState();
      const state = store.state;
      if (state.outcome !== "in_progress") return;
      const to = { x: state.hero.position.x + dir.dx, y: state.hero.position.y + dir.dy };
      console.log("[swipe] to", to);
      if (!state.currentFloor.grid.inBounds(to)) return;
      prevent();
      const accepted = store.move(to);
      console.log("[swipe] move accepted", accepted);
      if (!accepted) return;
      console.log("[swipe] hapticsEnabled", hapticsEnabled);
      if (!hapticsEnabled) return;

      const events = useRunStore.getState().lastEvents;
      const charged = events.some((ev) => ev.type === "LATTICE_CHARGED");
      const attack = events.some((ev) => ev.type === "DAMAGE_DEALT");
      console.log("[swipe] events", { charged, attack, types: events.map((ev) => ev.type) });

      if (charged) {
        console.log("[swipe] trigger lattice");
        trigger([
          { duration: 45, intensity: 0.7 },
          { delay: 70, duration: 55, intensity: 1 },
        ]);
        return;
      }
      if (attack) {
        console.log("[swipe] trigger attack");
        trigger([{ duration: 35, intensity: 1 }]);
        return;
      }

      console.log("[swipe] trigger swipe");
      trigger([
        { duration: 80, intensity: 0.8 },
        { delay: 80, duration: 50, intensity: 0.3 },
      ]);
    }

    function onPointerDown(e: PointerEvent) {
      if (e.pointerType === "mouse") return;
      if (!e.isPrimary) return;
      if (active) return;
      if (isSwipeExemptTarget(e.target)) return;
      console.log("[swipe] down", { pointerId: e.pointerId, x: e.clientX, y: e.clientY, target: (e.target as Element | null)?.tagName });
      active = {
        id: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        moved: false,
        kind: "pointer",
      };
    }

    function onPointerMove(e: PointerEvent) {
      if (!active || active.kind !== "pointer" || e.pointerId !== active.id) return;
      active.lastX = e.clientX;
      active.lastY = e.clientY;
      const dx = active.lastX - active.startX;
      const dy = active.lastY - active.startY;
      if (!active.moved && Math.hypot(dx, dy) >= MIN_SWIPE_PX) active.moved = true;
      if (active.moved) e.preventDefault();
    }

    function endGesture(e: PointerEvent) {
      if (!active || active.kind !== "pointer" || e.pointerId !== active.id) return;
      const dx = active.lastX - active.startX;
      const dy = active.lastY - active.startY;
      const moved = active.moved;
      active = null;
      if (!moved) return;
      handleEnd(dx, dy, () => e.preventDefault());
    }

    function onPointerCancel(e: PointerEvent) {
      if (!active || active.kind !== "pointer" || e.pointerId !== active.id) return;
      active = null;
    }

    function onTouchStart(e: TouchEvent) {
      if (active) return;
      if (isSwipeExemptTarget(e.target)) return;
      const t = e.changedTouches[0];
      if (!t) return;
      console.log("[swipe] touchstart", { id: t.identifier, x: t.clientX, y: t.clientY, target: (e.target as Element | null)?.tagName });
      active = {
        id: t.identifier,
        startX: t.clientX,
        startY: t.clientY,
        lastX: t.clientX,
        lastY: t.clientY,
        moved: false,
        kind: "touch",
      };
    }

    function onTouchMove(e: TouchEvent) {
      if (!active || active.kind !== "touch") return;
      const t = Array.from(e.changedTouches).find((x) => x.identifier === active!.id);
      if (!t) return;
      active.lastX = t.clientX;
      active.lastY = t.clientY;
      const dx = active.lastX - active.startX;
      const dy = active.lastY - active.startY;
      if (!active.moved && Math.hypot(dx, dy) >= MIN_SWIPE_PX) active.moved = true;
      if (active.moved) e.preventDefault();
    }

    function onTouchEnd(e: TouchEvent) {
      if (!active || active.kind !== "touch") return;
      const t = Array.from(e.changedTouches).find((x) => x.identifier === active!.id);
      if (!t) return;
      const dx = active.lastX - active.startX;
      const dy = active.lastY - active.startY;
      const moved = active.moved;
      active = null;
      if (!moved) return;
      handleEnd(dx, dy, () => e.preventDefault());
    }

    function onTouchCancel() {
      if (!active || active.kind !== "touch") return;
      active = null;
    }

    window.addEventListener("pointerdown", onPointerDown, { passive: true, capture: true });
    window.addEventListener("pointermove", onPointerMove, { passive: false, capture: true });
    window.addEventListener("pointerup", endGesture, { passive: false, capture: true });
    window.addEventListener("pointercancel", onPointerCancel, { capture: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true, capture: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false, capture: true });
    window.addEventListener("touchend", onTouchEnd, { passive: false, capture: true });
    window.addEventListener("touchcancel", onTouchCancel, { capture: true });
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerup", endGesture, true);
      window.removeEventListener("pointercancel", onPointerCancel, true);
      window.removeEventListener("touchstart", onTouchStart, true);
      window.removeEventListener("touchmove", onTouchMove, true);
      window.removeEventListener("touchend", onTouchEnd, true);
      window.removeEventListener("touchcancel", onTouchCancel, true);
    };
  }, [hapticsEnabled, trigger, attemptMove]);

  function updateAnimSpeed(v: number) {
    const clamped = Math.max(0.2, Math.min(2, v));
    setAnimSpeed(clamped);
    try {
      localStorage.setItem(ANIM_SPEED_STORAGE_KEY, String(clamped));
    } catch {}
  }

  function updateHapticsEnabled(v: boolean) {
    setHapticsEnabled(v);
    try {
      localStorage.setItem(HAPTICS_STORAGE_KEY, v ? "1" : "0");
    } catch {}
  }

  function localeFlag(locale: ReturnType<typeof getLocale>): string {
    switch (locale) {
      case "en":
        return "🇺🇸";
      case "es":
        return "🇵🇪";
      case "pt":
        return "🇧🇷";
    }
  }

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        maxHeight: "100dvh",
        maxWidth: 900,
        margin: "0 auto",
        padding: "env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <header
        style={{
          padding: "4px 8px 0",
          letterSpacing: "0.12em",
          fontSize: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => setSettingsOpen(true)}
          title={t("header.settingsLabel")}
          style={{
            width: 34,
            height: 22,
            background: "transparent",
            color: "#e9e7d8",
            border: "1px solid #2a2a3e",
            borderRadius: 6,
            fontFamily: "inherit",
            fontSize: 14,
            lineHeight: "20px",
            cursor: "pointer",
            opacity: 0.9,
          }}
        >
          ⚙️
        </button>
        <div
          style={{
            flex: 1,
            display: "flex",
            justifyContent: "center",
            alignItems: "baseline",
            gap: 10,
            pointerEvents: "none",
          }}
        >
          <span style={{ letterSpacing: 0 }}>
            {t("hud.floorLabel")}&nbsp;{floorIndex + 1}
          </span>
          <span>{t("app.title")}</span>
          <span style={{ letterSpacing: 0 }}>{`🏆 ${score}`}</span>
        </div>
        <button
          onClick={() => setHelpOpen(true)}
          title={t("header.helpLabel")}
          style={{
            width: 34,
            height: 22,
            background: "transparent",
            color: "#e9e7d8",
            border: "1px solid #2a2a3e",
            borderRadius: 6,
            fontFamily: "inherit",
            fontSize: 14,
            lineHeight: "20px",
            cursor: "pointer",
            opacity: 0.9,
          }}
        >
          📜
        </button>
      </header>
      <GridView animSpeed={animSpeed} onMove={onGridMove} />
      <HUD />

      {helpOpen && (
        <div
          onClick={() => setHelpOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(11, 11, 20, 0.72)",
            display: "grid",
            placeItems: "center",
            zIndex: 10,
            padding: 16,
            boxSizing: "border-box",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(520px, 100%)",
              background: "#11111c",
              border: "1px solid #2a2a3e",
              borderRadius: 10,
              padding: "14px 14px 12px",
              color: "#e9e7d8",
              fontFamily: "ui-monospace, monospace",
              letterSpacing: 0,
              opacity: 0.98,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div style={{ fontWeight: 700 }}>{t("help.title")}</div>
              <button
                onClick={() => setHelpOpen(false)}
                style={{
                  background: "transparent",
                  color: "#e9e7d8",
                  border: "1px solid #2a2a3e",
                  borderRadius: 6,
                  padding: "2px 8px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 12,
                  lineHeight: "18px",
                  opacity: 0.9,
                }}
              >
                {t("help.close")}
              </button>
            </div>
            <div
              style={{
                marginTop: 10,
                fontSize: 12,
                lineHeight: "18px",
                opacity: 0.9,
                maxHeight: "70dvh",
                overflowY: "auto",
                paddingRight: 4,
              }}
            >
              {HELP_SECTIONS.map((s) => (
                <section key={s} style={{ marginBottom: 10 }}>
                  {s === "lattices" ? (
                    <details
                      style={{
                        border: "1px solid #2a2a3e",
                        borderRadius: 8,
                        padding: "6px 8px",
                        background: "rgba(26, 26, 42, 0.25)",
                      }}
                    >
                      <summary
                        style={{
                          fontWeight: 700,
                          fontSize: 11,
                          letterSpacing: 1,
                          textTransform: "uppercase",
                          opacity: 0.75,
                          cursor: "pointer",
                          listStyle: "none",
                          outline: "none",
                        }}
                      >
                        {t(`help.section.${s}.title`)}
                        <span style={{ marginLeft: 8, opacity: 0.6, letterSpacing: 0, fontSize: 10 }}>
                          {t("help.section.lattices.hint")}
                        </span>
                      </summary>
                      <div style={{ whiteSpace: "pre-wrap", marginTop: 6 }}>
                        {t(`help.section.${s}.body`)}
                      </div>
                    </details>
                  ) : (
                    <>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 11,
                          letterSpacing: 1,
                          textTransform: "uppercase",
                          opacity: 0.6,
                          marginBottom: 3,
                        }}
                      >
                        {t(`help.section.${s}.title`)}
                      </div>
                      <div style={{ whiteSpace: "pre-wrap" }}>
                        {t(`help.section.${s}.body`)}
                      </div>
                    </>
                  )}
                </section>
              ))}
            </div>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div
          onClick={() => setSettingsOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(11, 11, 20, 0.72)",
            display: "grid",
            placeItems: "center",
            zIndex: 11,
            padding: 16,
            boxSizing: "border-box",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(520px, 100%)",
              background: "#11111c",
              border: "1px solid #2a2a3e",
              borderRadius: 10,
              padding: "14px 14px 12px",
              color: "#e9e7d8",
              fontFamily: "ui-monospace, monospace",
              letterSpacing: 0,
              opacity: 0.98,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div style={{ fontWeight: 700 }}>{t("settings.title")}</div>
              <button
                onClick={() => setSettingsOpen(false)}
                style={{
                  background: "transparent",
                  color: "#e9e7d8",
                  border: "1px solid #2a2a3e",
                  borderRadius: 6,
                  padding: "2px 8px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 12,
                  lineHeight: "18px",
                  opacity: 0.9,
                }}
              >
                {t("settings.close")}
              </button>
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 10, fontSize: 12, lineHeight: "18px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ opacity: 0.85 }}>{t("settings.language")}</div>
                <select
                  value={getLocale()}
                  onChange={(e) => setLocale(e.target.value as (typeof LOCALES)[number])}
                  style={{
                    background: "#11111c",
                    color: "#e9e7d8",
                    border: "1px solid #2a2a3e",
                    borderRadius: 8,
                    padding: "6px 8px",
                    fontFamily: "inherit",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {LOCALES.map((loc) => (
                    <option key={loc} value={loc}>
                      {localeFlag(loc)} {loc.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                  <div style={{ opacity: 0.85 }}>{t("settings.animSpeed")}</div>
                  <div style={{ opacity: 0.7, letterSpacing: 0 }}>{animSpeed.toFixed(2)}</div>
                </div>
                <input
                  type="range"
                  min={0.2}
                  max={2}
                  step={0.05}
                  value={animSpeed}
                  onChange={(e) => updateAnimSpeed(Number(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={hapticsEnabled}
                  onChange={(e) => updateHapticsEnabled(e.target.checked)}
                />
                <span style={{ opacity: 0.85 }}>{t("settings.haptics")}</span>
              </label>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
