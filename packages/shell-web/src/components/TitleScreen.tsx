import type { CSSProperties } from "react";
import { t } from "../i18n.js";
import {
  COLORS,
  FONTS,
  displayHeading,
  pixelBorder,
  pixelButtonGhost,
  pixelButtonPrimary,
  pixelCard,
  pixelChip,
  sectionLabel,
} from "../theme.js";

export type TitleCardEntry = {
  readonly name: string;
  readonly score: number;
  readonly floor: number;
  readonly emoji: string;
};

const FEATURE_ICONS = ["🐾", "◆", "💀"] as const;
const FEATURE_KEYS = ["realRuns", "lattices", "builtForLoss"] as const;

export function TitleScreen({
  playerName,
  topRuns,
  canContinue,
  onStart,
  onOpenHelp,
  onOpenSettings,
  onOpenLeaderboard,
  onOpenName,
}: {
  playerName: string;
  topRuns: ReadonlyArray<TitleCardEntry>;
  canContinue: boolean;
  onStart: () => void;
  onOpenHelp: () => void;
  onOpenSettings: () => void;
  onOpenLeaderboard: () => void;
  onOpenName: () => void;
}) {
  const challengers = topRuns.slice(0, 5);
  const ctaLabel = canContinue ? t("title.continue") : t("title.cta");
  const displayName = playerName.trim() || "PLAYER";

  return (
    <div
      className="dap-title-root"
      style={{
        position: "relative",
        height: "100%",
        width: "100%",
        overflow: "scroll",
        boxSizing: "border-box",
        color: COLORS.text,
        fontFamily: FONTS.body,
      }}
    >
      <TopBar
        playerName={displayName}
        onOpenName={onOpenName}
        onOpenSettings={onOpenSettings}
      />

      <div className="dap-title-grid">
        <div className="dap-title-hero">
          <HeroBlock />
        </div>
        <div className="dap-title-features">
          <FeatureColumn />
        </div>
      </div>

      <div className="dap-cta-row">
        <button
          onClick={onStart}
          className="dap-cta"
          style={{
            ...pixelButtonPrimary,
            fontSize: 14,
            padding: "14px 26px",
          }}
        >
          {ctaLabel}{" "}
          <span aria-hidden="true" style={{ color: "#fff" }}>
            ♥
          </span>
        </button>
        <div
          style={{
            ...sectionLabel,
            whiteSpace: "pre-line",
            lineHeight: 1.5,
            color: COLORS.textMuted,
            fontSize: 10,
          }}
        >
          {t("title.ctaNote")}
        </div>
        <div style={{ flex: 1 }} />
        <SansBubble />
      </div>

      <div className="dap-title-runs">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 8,
            paddingInline: 4,
          }}
        >
          <div style={sectionLabel}>{t("title.runsHeader")}</div>
          <button
            onClick={onOpenLeaderboard}
            style={{
              ...pixelChip,
              fontFamily: FONTS.display,
              fontSize: 9,
              letterSpacing: "0.18em",
              padding: "5px 9px",
            }}
          >
            {t("title.menuLeaderboard")}
          </button>
        </div>
        {challengers.length > 0 ? <ChallengerStrip challengers={challengers} /> : <RunsEmptyState />}
      </div>

      <div className="dap-bottom-tags">
        <div style={{ ...sectionLabel, color: COLORS.textFaint }}>
          <span style={{ color: COLORS.accent }}>◆</span> {t("title.bottomLeft")}
        </div>
        <div style={{ ...sectionLabel, color: COLORS.textFaint }}>
          {t("title.bottomRight")}{" "}
          <span style={{ color: COLORS.primary }} className="dap-pulse">
            🐾
          </span>
        </div>
      </div>

      <MenuFooter
        onOpenHelp={onOpenHelp}
        onOpenSettings={onOpenSettings}
        onOpenLeaderboard={onOpenLeaderboard}
      />
    </div>
  );
}

function TopBar({
  playerName,
  onOpenName,
  onOpenSettings,
}: {
  playerName: string;
  onOpenName: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <div className="dap-title-topbar">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            ...sectionLabel,
            lineHeight: 1.2,
            fontSize: "clamp(9px, 2.6vw, 10px)",
            whiteSpace: "pre-line",
          }}
        >
          {t("title.tagline")}
        </span>
      </div>
      <div
        style={{
          ...sectionLabel,
          fontSize: "clamp(9px, 2.6vw, 10px)",
          letterSpacing: "0.22em",
          textAlign: "center",
          color: COLORS.textFaint,
        }}
      >
        ✦ {t("title.crest")} ✦
      </div>
      <div className="dap-topbar-actions" style={{ display: "flex", justifyContent: "flex-end", gap: 8, alignItems: "center" }}>
        <button
          onClick={onOpenName}
          title={t("settings.editName")}
          style={{
            ...pixelChip,
            fontFamily: FONTS.display,
            fontSize: 8,
            letterSpacing: "0.18em",
            padding: "6px 10px",
          }}
        >
          🐾 {playerName}
        </button>
        <button
          onClick={onOpenSettings}
          title={t("header.settingsLabel")}
          style={{
            ...pixelChip,
            padding: "6px 10px",
            fontFamily: FONTS.body,
            fontSize: 16,
            letterSpacing: 0,
          }}
        >
          ⚙
        </button>
      </div>
    </div>
  );
}

function HeroBlock() {
  return (
    <div>
      <h1
        style={{
          ...displayHeading,
          margin: 0,
          fontSize: "clamp(34px, 9.2vw, 86px)",
          letterSpacing: "0",
          wordSpacing: "-0.8em",
          lineHeight: 1.02,
        }}
      >
        <div>
          Dungeons & Paws
          <span
            aria-hidden="true"
            className="dap-pulse"
            style={{ color: COLORS.primary, marginLeft: 10, display: "inline-block" }}
          >
            🐾
          </span>
        </div>
      </h1>
      <div
        style={{
          marginTop: 18,
          fontFamily: FONTS.body,
          fontSize: "clamp(16px, 4.6vw, 20px)",
          letterSpacing: "0.04em",
          lineHeight: 1.5,
          whiteSpace: "pre-line",
          color: COLORS.textMuted,
        }}
      >
        {t("title.subtitle")}
      </div>
    </div>
  );
}

function FeatureColumn() {
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <FloweyBubble />
      {FEATURE_KEYS.map((k, i) => (
        <FeatureRow
          key={k}
          icon={FEATURE_ICONS[i] ?? "♥"}
          tone={i === 1 ? COLORS.accent : COLORS.heart}
          title={t(`title.feature.${k}.title`)}
          body={t(`title.feature.${k}.body`)}
        />
      ))}
    </div>
  );
}

function FeatureRow({
  icon,
  tone,
  title,
  body,
}: {
  icon: string;
  tone: string;
  title: string;
  body: string;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 10, alignItems: "start" }}>
      <span
        style={{
          color: tone,
          fontSize: 18,
          lineHeight: "20px",
          width: 24,
          textAlign: "center",
        }}
      >
        {icon}
      </span>
      <div>
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: 11,
            letterSpacing: "0.16em",
            color: COLORS.text,
            marginBottom: 6,
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 16, lineHeight: 1.4, color: COLORS.textMuted }}>{body}</div>
      </div>
    </div>
  );
}

function FloweyBubble() {
  return (
    <div
      style={{
        ...pixelCard,
        padding: "10px 12px",
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        gap: 10,
        alignItems: "center",
      }}
    >
      <div
        style={{
          fontSize: 28,
          lineHeight: "28px",
          width: 36,
          height: 36,
          display: "grid",
          placeItems: "center",
          background: COLORS.bgSunken,
          ...pixelBorder(COLORS.borderDim, 1),
        }}
        aria-hidden="true"
      >
        🕯
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.35 }}>
        <div>{t("title.flowey1")}</div>
        <div style={{ marginTop: 4 }}>
          <span style={{ color: COLORS.heart }}>♥</span> {t("title.flowey2")}
        </div>
      </div>
    </div>
  );
}

function SansBubble() {
  return (
    <div
      style={{
        ...pixelCard,
        padding: "10px 12px",
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        gap: 10,
        alignItems: "center",
        maxWidth: 320,
      }}
    >
      <div
        style={{
          fontSize: 26,
          lineHeight: "26px",
          width: 36,
          height: 36,
          display: "grid",
          placeItems: "center",
          background: COLORS.bgSunken,
          ...pixelBorder(COLORS.borderDim, 1),
        }}
        aria-hidden="true"
      >
        💀
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.35, color: COLORS.text }}>
        <div>{t("title.sansLine1")}</div>
        <div>{t("title.sansLine2")}</div>
      </div>
    </div>
  );
}

function ChallengerStrip({ challengers }: { challengers: ReadonlyArray<TitleCardEntry> }) {
  return (
    <div className="dap-challenger-strip">
      {challengers.map((c, i) => (
        <ChallengerCard key={i} entry={c} highlight={i === 2} rank={i + 1} />
      ))}
    </div>
  );
}

function RunsEmptyState() {
  return (
    <div
      style={{
        ...pixelCard,
        padding: "14px 14px",
        display: "grid",
        gap: 8,
        placeItems: "center",
        textAlign: "center",
      }}
    >
      <div style={{ fontFamily: FONTS.display, fontSize: 9, letterSpacing: "0.16em", color: COLORS.text }}>
        {t("title.runsEmpty")}
      </div>
      <div style={{ fontFamily: FONTS.body, fontSize: 16, color: COLORS.textMuted, lineHeight: 1.35 }}>
        {t("title.runsEmptyHint")}
      </div>
    </div>
  );
}

function ChallengerCard({
  entry,
  highlight,
  rank,
}: {
  entry: TitleCardEntry;
  highlight: boolean;
  rank: number;
}) {
  const cardStyle: CSSProperties = {
    position: "relative",
    background: COLORS.bgPanel,
    backdropFilter: "blur(8px) saturate(1.15)",
    WebkitBackdropFilter: "blur(8px) saturate(1.15)",
    ...pixelBorder(highlight ? COLORS.primary : COLORS.borderSubtle, highlight ? 2 : 1),
    padding: "12px 8px 10px",
    display: "grid",
    gap: 6,
    placeItems: "center",
    color: COLORS.text,
    boxShadow: highlight
      ? `0 0 0 1px rgba(0, 0, 0, 0.3), 0 0 22px ${COLORS.primaryGlow}`
      : "0 0 0 1px rgba(0, 0, 0, 0.25)",
    minHeight: "clamp(96px, 14vh, 124px)",
  };
  return (
    <div style={cardStyle}>
      <div
        style={{
          position: "absolute",
          top: -8,
          right: -6,
          background: highlight ? COLORS.primary : COLORS.bgPanel,
          color: highlight ? "#fff" : COLORS.text,
          ...pixelBorder(highlight ? COLORS.primary : COLORS.borderSubtle, 1),
          padding: "2px 6px",
          fontFamily: FONTS.display,
          fontSize: 9,
          letterSpacing: "0.14em",
          lineHeight: 1.2,
        }}
      >
        #{rank}
      </div>
      <div style={{ fontSize: 30, lineHeight: "30px" }} aria-hidden="true">
        {entry.emoji}
      </div>
      <div
        style={{
          fontFamily: FONTS.display,
          fontSize: 9,
          letterSpacing: "0.14em",
          textAlign: "center",
          color: COLORS.text,
          maxWidth: "100%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {entry.name}
      </div>
      <div
        style={{
          fontSize: 12,
          color: COLORS.textMuted,
          textAlign: "center",
          letterSpacing: "0.06em",
        }}
      >
        🏆 {entry.score} · {t("hud.floorLabel")} {entry.floor}
      </div>
    </div>
  );
}

function MenuFooter({
  onOpenHelp,
  onOpenSettings,
  onOpenLeaderboard,
}: {
  onOpenHelp: () => void;
  onOpenSettings: () => void;
  onOpenLeaderboard: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        justifyContent: "center",
      }}
    >
      <button onClick={onOpenHelp} style={{ ...pixelButtonGhost }}>
        📜 {t("title.menuHelp")}
      </button>
      <button onClick={onOpenLeaderboard} style={{ ...pixelButtonGhost }}>
        🌎 {t("title.menuLeaderboard")}
      </button>
      <button onClick={onOpenSettings} style={{ ...pixelButtonGhost }}>
        ⚙ {t("title.menuSettings")}
      </button>
    </div>
  );
}
