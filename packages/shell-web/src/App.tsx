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
          <span style={{ opacity: 0.75, letterSpacing: 0 }}>{`P${floorIndex + 1}`}</span>
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
