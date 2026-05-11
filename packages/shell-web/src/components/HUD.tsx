import { useEffect, useState } from "react";
import { RUNES, xpToNextLevel, type LatticeKind } from "@gridlore/engine";
import { useRunStore } from "../state/store.js";
import { subscribeLocaleChange, t, tRune } from "../i18n.js";

export function HUD() {
  const [, bump] = useState(0);
  const state = useRunStore((s) => s.state);
  const reset = useRunStore((s) => s.reset);
  const usePotion = useRunStore((s) => s.usePotion);
  const events = useRunStore((s) => s.lastEvents);
  const lastEvent = events[events.length - 1];

  const { hero, currentFloor, meta, turn, outcome } = state;
  const lattices = currentFloor.lattices;
  const chargedCount = Array.from(lattices.byId.values()).filter((l) => l.isCharged).length;
  const totalLattices = lattices.byId.size;
  const lastKeystone = [...events].reverse().find((e) => e.type === "KEYSTONE_BONUS");

  useEffect(() => subscribeLocaleChange(() => bump((x) => x + 1)), []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: "6px 10px 8px",
        fontFamily: "ui-monospace, monospace",
        fontSize: 12,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "0.4rem",
          flexWrap: "nowrap",
          opacity: 0.95,
          height: 18,
          lineHeight: "18px",
          fontSize: 10,
          overflow: "hidden",
          whiteSpace: "nowrap",
        }}
      >
        <span>♥&nbsp;{hero.hp}/{hero.hpMax}</span>
        <span>◆&nbsp;{hero.focus}/{hero.focusMax}</span>
        <span>🛡&nbsp;{hero.armor}</span>
        <span>🪙&nbsp;{meta.gold}</span>
        <span>
          {t("hud.floorAbbr")}&nbsp;{currentFloor.index + 1}
        </span>
        <span>
          {t("hud.turnAbbr")}&nbsp;{turn}
        </span>
        <span>⚡&nbsp;{chargedCount}/{totalLattices}</span>
        <button
          onClick={() => reset(`GRD-${Math.random().toString(36).slice(2, 8).toUpperCase()}`)}
          style={{
            background: "transparent",
            color: "#e9e7d8",
            border: "1px solid #2a2a3e",
            padding: "0 0.35rem",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 10,
            borderRadius: 3,
            lineHeight: "16px",
            height: 18,
          }}
        >
          {t("hud.newRun")}
        </button>
      </div>

      <LatticeStrip />

      {/* Always reserve space for the keystone callout so the grid never reflows. */}
      <div
        style={{
          height: 22,
          color: "#ffd95a",
          background: lastKeystone ? "#2a2a3e" : "transparent",
          padding: "2px 6px",
          borderRadius: 3,
          textAlign: "center",
          fontSize: 11,
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
          boxSizing: "border-box",
          lineHeight: "18px",
        }}
      >
        {lastKeystone && lastKeystone.type === "KEYSTONE_BONUS"
          ? formatEvent(lastKeystone)
          : " "}
      </div>

      <div
        style={{
          opacity: 0.55,
          height: 16,
          lineHeight: "16px",
          textAlign: "center",
          fontSize: 11,
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
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginTop: 4,
          padding: "6px 10px 2px",
          borderTop: "1px solid #2a2a3e",
          fontFamily: "ui-monospace, monospace",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 170 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
            <div style={{ fontSize: 16, letterSpacing: "0.06em" }}>
              {t("hud.floorLabel")}&nbsp;{currentFloor.index + 1}
            </div>
            <div style={{ fontSize: 16, letterSpacing: "0.06em" }}>
              {t("hud.levelLabel")}&nbsp;{hero.level}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 10, opacity: 0.7, width: 30 }}>{t("hud.xpLabel")}</div>
            <div
              style={{
                flex: 1,
                height: 10,
                background: "#1a1a2a",
                border: "1px solid #2a2a3e",
                borderRadius: 999,
                overflow: "hidden",
              }}
              title={`${hero.xp}/${xpToNextLevel(hero.level)}`}
            >
              <div
                style={{
                  width: `${Math.round((hero.xp / xpToNextLevel(hero.level)) * 100)}%`,
                  height: "100%",
                  background: "#ffd95a",
                  opacity: 0.9,
                }}
              />
            </div>
            <div style={{ fontSize: 10, opacity: 0.7, width: 56, textAlign: "right" }}>
              {hero.xp}/{xpToNextLevel(hero.level)}
            </div>
          </div>
        </div>
        <button
          onClick={usePotion}
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 8,
            background: "transparent",
            color: "#e9e7d8",
            border: "1px solid #2a2a3e",
            borderRadius: 10,
            padding: "6px 10px",
            cursor: hero.potions > 0 && hero.hp < hero.hpMax ? "pointer" : "not-allowed",
            opacity: hero.potions > 0 ? 0.95 : 0.45,
            fontFamily: "inherit",
          }}
          title={`🧪 ${hero.potions}/${hero.potionsMax}`}
        >
          <span style={{ fontSize: 18, letterSpacing: 0 }}>🧪</span>
          <span style={{ fontSize: 16, letterSpacing: "0.06em" }}>
            {hero.potions}/{hero.potionsMax}
          </span>
        </button>
      </div>

      {outcome === "win" && <Overlay title={t("overlay.win")} tone="win" />}
      {outcome === "death" && <Overlay title={t("overlay.death")} tone="death" />}
    </div>
  );
}

function Overlay({ title, tone }: { title: string; tone: "win" | "death" }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(11, 11, 20, 0.7)",
        display: "grid",
        placeItems: "center",
        pointerEvents: "none",
        zIndex: 5,
      }}
    >
      <div
        style={{
          padding: "1.5rem 2rem",
          fontSize: "1.6rem",
          letterSpacing: "0.08em",
          color: tone === "win" ? "#ffd95a" : "#ff6a6a",
          background: "#11111c",
          border: `1px solid ${tone === "win" ? "#ffd95a" : "#ff6a6a"}`,
          borderRadius: 6,
        }}
      >
        {title}
      </div>
    </div>
  );
}

function LatticeStrip() {
  const state = useRunStore((s) => s.state);
  const lattices = state.currentFloor.lattices;
  const gridW = state.currentFloor.grid.width;
  const gridH = state.currentFloor.grid.height;
  const chamberCount = state.currentFloor.grid.chamberCount;

  const groups: { kind: LatticeKind; label: string; count: number }[] = [
    { kind: "row", label: t("hud.rowsAbbr"), count: gridH },
    { kind: "column", label: t("hud.colsAbbr"), count: gridW },
    { kind: "chamber", label: t("hud.chambersAbbr"), count: chamberCount },
  ];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 1,
        alignItems: "center",
      }}
    >
      {groups.map(({ kind, label, count }) => (
        <div
          key={kind}
          style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10 }}
        >
          <span style={{ width: 16, opacity: 0.55, textAlign: "right" }}>{label}</span>
          <div style={{ display: "flex", gap: 2 }}>
            {Array.from({ length: count }, (_, i) => {
              const id = `${kind}:${i}` as const;
              const lat = lattices.byId.get(id);
              const filled = lat?.runesPresent.size ?? 0;
              const threshold = lat?.chargeThreshold ?? RUNES.length;
              const charged = lat?.isCharged ?? false;
              return (
                <span
                  key={i}
                  title={`${id} ${filled}/${threshold}`}
                  style={{
                    display: "inline-block",
                    minWidth: 22,
                    textAlign: "center",
                    color: charged ? "#ffd95a" : "#7a7a90",
                    background: charged ? "#3a3a55" : "transparent",
                    borderRadius: 2,
                    padding: "0 3px",
                    lineHeight: 1.4,
                  }}
                >
                  {filled}/{threshold}
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function formatEvent(e: NonNullable<ReturnType<typeof useRunStore.getState>["lastEvents"][number]>): string {
  switch (e.type) {
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
      return t("event.potionGained", { potions: e.potions, max: e.potionsMax });
    case "POTION_USED":
      return t("event.potionUsed", { healed: e.healed, potions: e.potions, max: e.potionsMax });
    case "HERO_DAMAGED":
      return t("event.heroDamaged", { amount: e.amount });
    case "HERO_DIED":
      return t("event.heroDied");
    case "DAMAGE_DEALT":
      return "·";
    case "INPUT_REJECTED":
      return `× ${formatReject(e)}`;
    case "TURN_STARTED":
      return t("event.turnStarted", { turn: e.turn });
    default: {
      // Exhaustive switch — every event type handled.
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
    case "pending":
      return t("event.keystoneBonus.pending", { keystone: tRune(e.keystone) });
  }
}
