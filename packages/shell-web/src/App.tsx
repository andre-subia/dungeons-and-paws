import { useEffect, useState } from "react";
import { GridView } from "./components/GridView.js";
import { HUD } from "./components/HUD.js";
import { LOCALES, getLocale, setLocale, subscribeLocaleChange, t } from "./i18n.js";
import { useRunStore } from "./state/store.js";

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

export function App() {
  const [, bump] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const score = useRunStore((s) => s.state.meta.score);
  const floorIndex = useRunStore((s) => s.state.currentFloor.index);
  useEffect(() => subscribeLocaleChange(() => bump((x) => x + 1)), []);
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
      store.move(to);
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
        useRunStore.getState().usePotion();
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
  }, []);

  useEffect(() => {
    const MIN_SWIPE_PX = 24;
    let active:
      | {
          pointerId: number;
          startX: number;
          startY: number;
          lastX: number;
          lastY: number;
          moved: boolean;
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

    function onPointerDown(e: PointerEvent) {
      if (e.pointerType === "mouse") return;
      if (!e.isPrimary) return;
      if (active) return;
      if (isSwipeExemptTarget(e.target)) return;
      active = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        moved: false,
      };
    }

    function onPointerMove(e: PointerEvent) {
      if (!active || e.pointerId !== active.pointerId) return;
      active.lastX = e.clientX;
      active.lastY = e.clientY;
      const dx = active.lastX - active.startX;
      const dy = active.lastY - active.startY;
      if (!active.moved && Math.hypot(dx, dy) >= MIN_SWIPE_PX) active.moved = true;
      if (active.moved) e.preventDefault();
    }

    function endGesture(e: PointerEvent) {
      if (!active || e.pointerId !== active.pointerId) return;
      const dx = active.lastX - active.startX;
      const dy = active.lastY - active.startY;
      const moved = active.moved && Math.hypot(dx, dy) >= MIN_SWIPE_PX;
      active = null;

      if (!moved) return;
      const dir = directionFromDelta(dx, dy);
      if (!dir || (dir.dx === 0 && dir.dy === 0)) return;

      const store = useRunStore.getState();
      const state = store.state;
      if (state.outcome !== "in_progress") return;
      const to = { x: state.hero.position.x + dir.dx, y: state.hero.position.y + dir.dy };
      if (!state.currentFloor.grid.inBounds(to)) return;
      e.preventDefault();
      store.move(to);
    }

    function onPointerCancel(e: PointerEvent) {
      if (!active || e.pointerId !== active.pointerId) return;
      active = null;
    }

    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", endGesture, { passive: false });
    window.addEventListener("pointercancel", onPointerCancel);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endGesture);
      window.removeEventListener("pointercancel", onPointerCancel);
    };
  }, []);

  function cycleLocale() {
    const cur = getLocale();
    const idx = LOCALES.indexOf(cur);
    const next = LOCALES[(idx + 1) % LOCALES.length]!;
    setLocale(next);
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
          onClick={cycleLocale}
          title={t("header.langLabel")}
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
          {localeFlag(getLocale())}
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
      <GridView />
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
    </main>
  );
}
