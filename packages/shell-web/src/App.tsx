import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GridView } from "./components/GridView.js";
import { HUD } from "./components/HUD.js";
import { TitleScreen, type TitleCardEntry } from "./components/TitleScreen.js";
import { LOCALES, getLocale, setLocale, subscribeLocaleChange, t } from "./i18n.js";
import { useRunStore } from "./state/store.js";
import { useWebHaptics } from "web-haptics/react";
import {
  COLORS,
  FONTS,
  modalBackdrop,
  modalPanel,
  pixelBorder,
  pixelButtonGhost,
  pixelButtonPrimary,
  pixelChip,
  sectionLabel,
} from "./theme.js";
import bgUkuPacha from "./assets/uku-pacha.png";
import bgDungeon from "./assets/dungeon.png";
import type { Cell, RunOutcome } from "@gridlore/engine";

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
const SWIPE_SENSITIVITY_STORAGE_KEY = "gridlore:swipeSensitivity";
const LEGAL_MOVE_OPACITY_STORAGE_KEY = "gridlore:legalMoveOpacity";
const PLAYER_NAME_STORAGE_KEY = "gridlore:playerName";
const PLAYER_ID_STORAGE_KEY = "gridlore:playerId";
const DEFAULT_ANIM_SPEED = 0.7;
const DEFAULT_HAPTICS_ENABLED = true;
const DEFAULT_SWIPE_SENSITIVITY = 1.25;
const DEFAULT_LEGAL_MOVE_OPACITY = 0.4;
const DEFAULT_PLAYER_NAME = "";
const TUTORIAL_SEEN_KEY = "gridlore:tutorialSeen:v1";

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "";
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? "";
const LEADERBOARD_TABLE = (import.meta.env.VITE_SUPABASE_LEADERBOARD_TABLE as string | undefined) ?? "leaderboard_entries";
let leaderboardSupportsPlayerId: boolean | null = null;

const CHALLENGER_EMOJI: ReadonlyArray<string> = ["🐱", "🦇", "🕷", "💀", "👹", "🐀", "🐍", "👻"];

function readAnimSpeed(): number {
  try {
    const raw = localStorage.getItem(ANIM_SPEED_STORAGE_KEY);
    const n = raw == null ? NaN : Number(raw);
    if (!Number.isFinite(n)) return DEFAULT_ANIM_SPEED;
    return Math.max(0.2, Math.min(2, n));
  } catch {
    return DEFAULT_ANIM_SPEED;
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

function readSwipeSensitivity(): number {
  try {
    const raw = localStorage.getItem(SWIPE_SENSITIVITY_STORAGE_KEY);
    const n = raw == null ? NaN : Number(raw);
    if (!Number.isFinite(n)) return DEFAULT_SWIPE_SENSITIVITY;
    return Math.max(0.5, Math.min(2, n));
  } catch {
    return DEFAULT_SWIPE_SENSITIVITY;
  }
}

function readLegalMoveOpacity(): number {
  try {
    const raw = localStorage.getItem(LEGAL_MOVE_OPACITY_STORAGE_KEY);
    const n = raw == null ? NaN : Number(raw);
    if (!Number.isFinite(n)) return DEFAULT_LEGAL_MOVE_OPACITY;
    return Math.max(0.05, Math.min(1, n));
  } catch {
    return DEFAULT_LEGAL_MOVE_OPACITY;
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

type LeaderboardEntry = {
  readonly name: string;
  readonly score: number;
  readonly ts: number;
  readonly seed: string;
  readonly floor: number;
  readonly outcome: Exclude<RunOutcome, "in_progress">;
};

type ScoreSubmission = Omit<LeaderboardEntry, "ts"> & {
  readonly playerId: string;
};

function hasLeaderboardBackend(): boolean {
  return SUPABASE_URL.trim() !== "" && SUPABASE_ANON_KEY.trim() !== "";
}

function supabaseHeaders(): HeadersInit {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
  };
}

async function fetchGlobalLeaderboard(limit = 20): Promise<LeaderboardEntry[]> {
  if (!hasLeaderboardBackend()) return [];
  const baseUrl = `${SUPABASE_URL.replace(/\/+$/, "")}/rest/v1/${LEADERBOARD_TABLE}`;
  const headers = { ...supabaseHeaders(), Accept: "application/json" };
  const buildUrl = (select: string) => {
    const url = new URL(baseUrl);
    url.searchParams.set("select", select);
    url.searchParams.set("order", "score.desc,created_at.desc");
    url.searchParams.set("limit", String(limit));
    return url.toString();
  };

  const resWithFloor = await fetch(buildUrl("name,score,created_at,seed,outcome,floor"), { headers });
  const res = resWithFloor.ok ? resWithFloor : await fetch(buildUrl("name,score,created_at,seed,outcome"), { headers });
  if (!res.ok) throw new Error(`leaderboard fetch failed (${res.status})`);

  const data = (await res.json()) as Array<{
    name: string;
    score: number;
    created_at: string;
    seed: string;
    outcome: "win" | "death";
    floor?: number | null;
  }>;
  return data.map((r) => ({
    name: r.name,
    score: r.score,
    ts: Date.parse(r.created_at) || Date.now(),
    seed: r.seed,
    floor: typeof r.floor === "number" && Number.isFinite(r.floor) && r.floor > 0 ? r.floor : 1,
    outcome: r.outcome,
  }));
}

async function submitScore(entry: ScoreSubmission): Promise<void> {
  if (!hasLeaderboardBackend()) return;
  const baseUrl = `${SUPABASE_URL.replace(/\/+$/, "")}/rest/v1/${LEADERBOARD_TABLE}`;
  const writeHeaders = { ...supabaseHeaders(), Prefer: "return=representation" };

  const tryInsertRow = async (row: Record<string, unknown>): Promise<Response> => {
    return fetch(baseUrl, {
      method: "POST",
      headers: writeHeaders,
      body: JSON.stringify([row]),
    });
  };

  const tryPatchByFilters = async (
    filters: Record<string, string>,
    body: Record<string, unknown>,
  ): Promise<Response> => {
    const url = new URL(baseUrl);
    for (const [k, v] of Object.entries(filters)) url.searchParams.set(k, v);
    return fetch(url.toString(), {
      method: "PATCH",
      headers: writeHeaders,
      body: JSON.stringify(body),
    });
  };

  const readChangedRowsCount = async (res: Response): Promise<number | null> => {
    if (!res.ok) return null;
    try {
      const data = (await res.json()) as unknown;
      if (Array.isArray(data)) return data.length;
      return null;
    } catch {
      return null;
    }
  };

  if (leaderboardSupportsPlayerId !== false) {
    const patchFilters = { player_id: `eq.${entry.playerId}`, score: `lt.${entry.score}` };
    const patchWithFloor = await tryPatchByFilters(patchFilters, {
      name: entry.name,
      score: entry.score,
      seed: entry.seed,
      outcome: entry.outcome,
      floor: entry.floor,
    });
    if (patchWithFloor.ok) {
      const changed = await readChangedRowsCount(patchWithFloor);
      if (changed != null && changed > 0) return;
    } else if (patchWithFloor.status === 400 || patchWithFloor.status === 404) {
      leaderboardSupportsPlayerId = false;
    }

    if (leaderboardSupportsPlayerId !== false) {
      const patchWithoutFloor = await tryPatchByFilters(patchFilters, {
        name: entry.name,
        score: entry.score,
        seed: entry.seed,
        outcome: entry.outcome,
      });
      if (patchWithoutFloor.ok) {
        const changed = await readChangedRowsCount(patchWithoutFloor);
        if (changed != null && changed > 0) return;
      } else if (patchWithoutFloor.status === 400 || patchWithoutFloor.status === 404) {
        leaderboardSupportsPlayerId = false;
      }
    }

    if (leaderboardSupportsPlayerId !== false) {
      const insertWithFloor = await tryInsertRow({
        player_id: entry.playerId,
        name: entry.name,
        score: entry.score,
        seed: entry.seed,
        outcome: entry.outcome,
        floor: entry.floor,
      });
      if (insertWithFloor.ok) return;
      if (insertWithFloor.status === 409) return;
      if (insertWithFloor.status === 400 || insertWithFloor.status === 404) leaderboardSupportsPlayerId = false;

      const insertWithoutFloor = await tryInsertRow({
        player_id: entry.playerId,
        name: entry.name,
        score: entry.score,
        seed: entry.seed,
        outcome: entry.outcome,
      });
      if (insertWithoutFloor.ok) return;
      if (insertWithoutFloor.status === 409) return;
      if (insertWithoutFloor.status === 400 || insertWithoutFloor.status === 404) leaderboardSupportsPlayerId = false;
    }
  }

  const patchByName = await tryPatchByFilters({ name: `eq.${entry.name}`, score: `lt.${entry.score}` }, {
    name: entry.name,
    score: entry.score,
    seed: entry.seed,
    outcome: entry.outcome,
    floor: entry.floor,
  });
  if (patchByName.ok) {
    const changed = await readChangedRowsCount(patchByName);
    if (changed != null && changed > 0) return;
  }

  const resWithFloor = await tryInsertRow({
    name: entry.name,
    score: entry.score,
    seed: entry.seed,
    outcome: entry.outcome,
    floor: entry.floor,
  });
  if (resWithFloor.ok) return;

  const resWithoutFloor = await tryInsertRow({
    name: entry.name,
    score: entry.score,
    seed: entry.seed,
    outcome: entry.outcome,
  });
  if (!resWithoutFloor.ok) throw new Error(`leaderboard insert failed (${resWithoutFloor.status})`);
}

function readPlayerName(): string {
  try {
    const raw = localStorage.getItem(PLAYER_NAME_STORAGE_KEY);
    return (raw ?? "").trim();
  } catch {
    return "";
  }
}

function generateUuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function readOrCreatePlayerId(): string {
  try {
    const existing = (localStorage.getItem(PLAYER_ID_STORAGE_KEY) ?? "").trim();
    if (existing !== "") return existing;
    const next = generateUuid();
    localStorage.setItem(PLAYER_ID_STORAGE_KEY, next);
    return next;
  } catch {
    return generateUuid();
  }
}

function newSeed(): string {
  return `GRD-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export function App() {
  const [, bump] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [animSpeed, setAnimSpeed] = useState(readAnimSpeed);
  const [hapticsEnabled, setHapticsEnabled] = useState(() => readBool(HAPTICS_STORAGE_KEY, DEFAULT_HAPTICS_ENABLED));
  const [swipeSensitivity, setSwipeSensitivity] = useState(readSwipeSensitivity);
  const [legalMoveOpacity, setLegalMoveOpacity] = useState(readLegalMoveOpacity);
  const [playerId] = useState(readOrCreatePlayerId);
  const [playerName, setPlayerName] = useState(() => readPlayerName() || DEFAULT_PLAYER_NAME);
  const [namePromptOpen, setNamePromptOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState(() => readPlayerName());
  const [pendingStartAfterName, setPendingStartAfterName] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [screen, setScreen] = useState<"title" | "playing">("title");
  const lastRecordedRef = useRef<string>("");
  const { trigger } = useWebHaptics();
  const score = useRunStore((s) => s.state.meta.score);
  const floorIndex = useRunStore((s) => s.state.currentFloor.index);
  const outcome = useRunStore((s) => s.state.outcome);
  const seed = useRunStore((s) => s.state.seed);
  const turn = useRunStore((s) => s.state.turn);
  const lastEvents = useRunStore((s) => s.lastEvents);
  const reset = useRunStore((s) => s.reset);
  const [tutorial, setTutorial] = useState<{ mode: "intro" | "bag"; step: number } | null>(null);
  const [tutorialPendingBag, setTutorialPendingBag] = useState(false);
  const [bagPotionConsumed, setBagPotionConsumed] = useState(false);
  const tutorialActive = tutorial !== null;
  useEffect(() => subscribeLocaleChange(() => bump((x) => x + 1)), []);

  const closeInventory = useCallback((force = false) => {
    window.dispatchEvent(new CustomEvent("ui:closeInventory", { detail: { force } }));
  }, []);

  const refreshLeaderboard = useCallback(async () => {
    if (!hasLeaderboardBackend()) return;
    try {
      const next = await fetchGlobalLeaderboard(20);
      setLeaderboard(next);
    } catch {
      setLeaderboard([]);
    }
  }, []);

  useEffect(() => {
    if (!hasLeaderboardBackend()) return;
    refreshLeaderboard();
  }, [refreshLeaderboard]);

  useEffect(() => {
    if (outcome === "in_progress") {
      lastRecordedRef.current = "";
      return;
    }
    const key = `${seed}:${outcome}:${score}:${floorIndex}`;
    if (lastRecordedRef.current === key) return;
    lastRecordedRef.current = key;

    const name = playerName.trim() || "Player";
    if (!hasLeaderboardBackend()) return;
    const floor = floorIndex + 1;
    submitScore({ playerId, name, score, seed, outcome, floor })
      .then(() => refreshLeaderboard())
      .catch(() => {});
  }, [floorIndex, outcome, playerId, playerName, refreshLeaderboard, score, seed]);

  const resetTutorial = useCallback(() => {
    try {
      localStorage.removeItem(TUTORIAL_SEEN_KEY);
    } catch {}
    closeInventory(true);
    setTutorialPendingBag(false);
    setTutorial(null);
    reset(newSeed());
    setHelpOpen(false);
    setSettingsOpen(false);
    setScreen("title");
  }, [closeInventory, reset]);

  const startRun = useCallback(() => {
    if (outcome !== "in_progress") {
      reset(newSeed());
    }
    setScreen("playing");
  }, [outcome, reset]);

  const startRunWithRequiredName = useCallback(() => {
    if (playerName.trim() === "") {
      setPendingStartAfterName(true);
      setNamePromptOpen(true);
      return;
    }
    setPendingStartAfterName(false);
    startRun();
  }, [playerName, startRun]);

  const tryAgain = useCallback(() => {
    reset(newSeed());
    setScreen("playing");
  }, [reset]);

  const returnToMenu = useCallback(() => {
    setScreen("title");
  }, []);

  const attemptMove = useCallback(
    (to: Cell, source: "tap" | "keyboard") => {
      if (tutorialActive && tutorial?.mode === "intro" && tutorial.step === 0) {
        setTutorial({ mode: "intro", step: 1 });
        return;
      }
      const allowDuringTutorial = tutorial?.mode === "intro" && tutorial.step === 2;
      if (tutorialActive && !allowDuringTutorial) return;
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
    [hapticsEnabled, trigger, tutorial, tutorialActive],
  );

  const onGridMove = useCallback((cell: Cell) => attemptMove(cell, "tap"), [attemptMove]);

  useEffect(() => {
    if (screen !== "playing") return;
    if (outcome !== "in_progress") return;
    if (floorIndex !== 0) return;
    if (turn !== 0) return;
    try {
      const seen = localStorage.getItem(TUTORIAL_SEEN_KEY);
      if (seen === "1") return;
    } catch {}
    useRunStore.getState().boostTutorialPotions(3);
    setTutorial({ mode: "intro", step: 0 });
    setTutorialPendingBag(false);
    setBagPotionConsumed(false);
  }, [floorIndex, outcome, screen, turn]);

  useEffect(() => {
    if (screen !== "playing") return;
    if (outcome !== "in_progress") return;
    if (floorIndex !== 0) return;
    if (!tutorialPendingBag) return;
    if (tutorialActive) return;
    try {
      const seen = localStorage.getItem(TUTORIAL_SEEN_KEY);
      if (seen === "1") return;
    } catch {}

    const heroDamaged = lastEvents.some((e) => e.type === "HERO_DAMAGED");
    if (!heroDamaged) return;

    useRunStore.getState().boostTutorialPotions(3);
    closeInventory(true);
    setTutorial({ mode: "bag", step: 0 });
    setBagPotionConsumed(false);
    setTutorialPendingBag(false);
  }, [closeInventory, floorIndex, lastEvents, outcome, screen, tutorialActive, tutorialPendingBag]);

  useEffect(() => {
    if (screen !== "playing") return;
    if (!tutorial || tutorial.mode !== "intro") return;
    if (tutorial.step !== 2) return;
    const heroAttacked = lastEvents.some(
      (e) => e.type === "DAMAGE_DEALT" && e.source === "hero" && e.target !== "hero" && e.amount > 0,
    );
    if (!heroAttacked) return;
    closeInventory(true);
    setTutorialPendingBag(true);
    setTutorial(null);
  }, [closeInventory, lastEvents, screen, tutorial]);

  useEffect(() => {
    if (screen !== "playing") return;
    if (!tutorial || tutorial.mode !== "bag") return;
    if (tutorial.step !== 1) return;
    if (bagPotionConsumed) return;
    const used = lastEvents.some((e) => e.type === "POTION_USED");
    if (!used) return;
    setBagPotionConsumed(true);
    try {
      localStorage.setItem(TUTORIAL_SEEN_KEY, "1");
    } catch {}
    closeInventory(true);
    setTutorialPendingBag(false);
    setTutorial(null);
  }, [bagPotionConsumed, closeInventory, lastEvents, screen, tutorial, tutorialPendingBag]);

  useEffect(() => {
    if (screen !== "playing") return;
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
  }, [attemptMove, hapticsEnabled, trigger, screen]);

  useEffect(() => {
    if (screen !== "playing") return;
    let active:
      | {
          id: number;
          startX: number;
          startY: number;
          lastX: number;
          lastY: number;
          moved: boolean;
          cellPx: number;
          thresholdPx: number;
          thresholdCells: number;
          kind: "pointer" | "touch";
        }
      | null = null;

    function readGridCellPx(): number {
      const host = document.querySelector('[data-grid-host="true"]');
      if (!(host instanceof HTMLElement)) return 0;
      const rect = host.getBoundingClientRect();
      if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height) || rect.width <= 0 || rect.height <= 0) return 0;
      const snap = useRunStore.getState().state;
      const grid = snap.currentFloor.grid;
      const px = Math.min(rect.width / grid.width, rect.height / grid.height);
      if (!Number.isFinite(px) || px <= 0) return 0;
      return px;
    }

    function thresholdsFor(cellPx: number): { thresholdPx: number; thresholdCells: number } {
      const thresholdCells = clamp(0.5 / swipeSensitivity, 0.25, 0.75);
      const fallbackPx = clamp(Math.round(22 / swipeSensitivity), 10, 60);
      const thresholdPx = cellPx > 0 ? clamp(Math.round(cellPx * thresholdCells), 10, 120) : fallbackPx;
      return { thresholdPx, thresholdCells };
    }

    function isSwipeExemptTarget(t: EventTarget | null): boolean {
      if (!t || !(t instanceof Element)) return false;
      return Boolean(t.closest('[data-swipe-exempt="true"]'));
    }

    function directionFromDelta(
      dx: number,
      dy: number,
      cellPx: number,
      thresholdPx: number,
      thresholdCells: number,
    ): { dx: -1 | 0 | 1; dy: -1 | 0 | 1 } | null {
      const dist = Math.hypot(dx, dy);
      if (dist < thresholdPx) return null;

      if (cellPx <= 0) {
        const ax = Math.abs(dx);
        const ay = Math.abs(dy);
        const sx: -1 | 0 | 1 = dx === 0 ? 0 : dx > 0 ? 1 : -1;
        const sy: -1 | 0 | 1 = dy === 0 ? 0 : dy > 0 ? 1 : -1;
        if (ax === 0 && ay === 0) return null;
        if (ax > ay) return { dx: sx, dy: 0 };
        return { dx: 0, dy: sy };
      }

      const dxCells = dx / cellPx;
      const dyCells = dy / cellPx;

      const outDx: -1 | 0 | 1 = Math.abs(dxCells) >= thresholdCells ? (dxCells > 0 ? 1 : -1) : 0;
      const outDy: -1 | 0 | 1 = Math.abs(dyCells) >= thresholdCells ? (dyCells > 0 ? 1 : -1) : 0;
      if (outDx === 0 && outDy === 0) return null;
      return { dx: outDx, dy: outDy };
    }

    function handleEnd(
      dx: number,
      dy: number,
      thresholds: { cellPx: number; thresholdPx: number; thresholdCells: number },
      prevent: () => void,
    ) {
      const dir = directionFromDelta(dx, dy, thresholds.cellPx, thresholds.thresholdPx, thresholds.thresholdCells);
      if (!dir || (dir.dx === 0 && dir.dy === 0)) return;

      if (tutorialActive && tutorial?.mode === "intro" && tutorial.step === 0) {
        prevent();
        setTutorial({ mode: "intro", step: 1 });
        return;
      }

      const allowDuringTutorial = tutorial?.mode === "intro" && tutorial.step === 2;
      if (tutorialActive && !allowDuringTutorial) return;

      const store = useRunStore.getState();
      const state = store.state;
      if (state.outcome !== "in_progress") return;
      const to = { x: state.hero.position.x + dir.dx, y: state.hero.position.y + dir.dy };
      if (!state.currentFloor.grid.inBounds(to)) return;
      prevent();
      const accepted = store.move(to);
      if (!accepted) return;
      if (!hapticsEnabled) return;

      const events = useRunStore.getState().lastEvents;
      const charged = events.some((ev) => ev.type === "LATTICE_CHARGED");
      const attack = events.some((ev) => ev.type === "DAMAGE_DEALT");

      if (charged) {
        trigger([
          { duration: 45, intensity: 0.7 },
          { delay: 70, duration: 55, intensity: 1 },
        ]);
        return;
      }
      if (attack) {
        trigger([{ duration: 35, intensity: 1 }]);
        return;
      }

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
      const cellPx = readGridCellPx();
      const { thresholdPx, thresholdCells } = thresholdsFor(cellPx);
      active = {
        id: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        moved: false,
        cellPx,
        thresholdPx,
        thresholdCells,
        kind: "pointer",
      };
    }

    function onPointerMove(e: PointerEvent) {
      if (!active || active.kind !== "pointer" || e.pointerId !== active.id) return;
      active.lastX = e.clientX;
      active.lastY = e.clientY;
      const dx = active.lastX - active.startX;
      const dy = active.lastY - active.startY;
      if (!active.moved && Math.hypot(dx, dy) >= active.thresholdPx) active.moved = true;
      if (active.moved) e.preventDefault();
    }

    function endGesture(e: PointerEvent) {
      if (!active || active.kind !== "pointer" || e.pointerId !== active.id) return;
      const dx = active.lastX - active.startX;
      const dy = active.lastY - active.startY;
      const moved = active.moved;
      const thresholds = { cellPx: active.cellPx, thresholdPx: active.thresholdPx, thresholdCells: active.thresholdCells };
      active = null;
      if (!moved) return;
      handleEnd(dx, dy, thresholds, () => e.preventDefault());
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
      const cellPx = readGridCellPx();
      const { thresholdPx, thresholdCells } = thresholdsFor(cellPx);
      active = {
        id: t.identifier,
        startX: t.clientX,
        startY: t.clientY,
        lastX: t.clientX,
        lastY: t.clientY,
        moved: false,
        cellPx,
        thresholdPx,
        thresholdCells,
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
      if (!active.moved && Math.hypot(dx, dy) >= active.thresholdPx) active.moved = true;
      if (active.moved) e.preventDefault();
    }

    function onTouchEnd(e: TouchEvent) {
      if (!active || active.kind !== "touch") return;
      const t = Array.from(e.changedTouches).find((x) => x.identifier === active!.id);
      if (!t) return;
      const dx = active.lastX - active.startX;
      const dy = active.lastY - active.startY;
      const moved = active.moved;
      const thresholds = { cellPx: active.cellPx, thresholdPx: active.thresholdPx, thresholdCells: active.thresholdCells };
      active = null;
      if (!moved) return;
      handleEnd(dx, dy, thresholds, () => e.preventDefault());
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
  }, [hapticsEnabled, trigger, swipeSensitivity, screen, tutorial, tutorialActive]);

  function updateAnimSpeed(v: number) {
    const clamped = Math.max(0.2, Math.min(2, v));
    setAnimSpeed(clamped);
    try {
      localStorage.setItem(ANIM_SPEED_STORAGE_KEY, String(clamped));
    } catch {}
  }

  function updateSwipeSensitivity(v: number) {
    const clamped = Math.max(0.5, Math.min(2, v));
    setSwipeSensitivity(clamped);
    try {
      localStorage.setItem(SWIPE_SENSITIVITY_STORAGE_KEY, String(clamped));
    } catch {}
  }

  function updateLegalMoveOpacity(v: number) {
    const clamped = Math.max(0.05, Math.min(1, v));
    setLegalMoveOpacity(clamped);
    try {
      localStorage.setItem(LEGAL_MOVE_OPACITY_STORAGE_KEY, String(clamped));
    } catch {}
  }

  function updateHapticsEnabled(v: boolean) {
    setHapticsEnabled(v);
    try {
      localStorage.setItem(HAPTICS_STORAGE_KEY, v ? "1" : "0");
    } catch {}
  }

  function savePlayerName(raw: string) {
    const cleaned = raw.trim().slice(0, 18);
    if (cleaned === "") return;
    const finalName = cleaned;
    setPlayerName(finalName);
    setNameDraft(finalName);
    try {
      localStorage.setItem(PLAYER_NAME_STORAGE_KEY, finalName);
    } catch {}
    setNamePromptOpen(false);
    if (pendingStartAfterName) {
      setPendingStartAfterName(false);
      startRun();
    }
  }

  function resetSettings() {
    setLocale("en");
    updateAnimSpeed(DEFAULT_ANIM_SPEED);
    updateSwipeSensitivity(DEFAULT_SWIPE_SENSITIVITY);
    updateLegalMoveOpacity(DEFAULT_LEGAL_MOVE_OPACITY);
    updateHapticsEnabled(DEFAULT_HAPTICS_ENABLED);
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

  const topRunsForCards: TitleCardEntry[] = useMemo(
    () =>
      leaderboard.slice(0, 5).map((entry, i) => ({
        name: entry.name,
        score: entry.score,
        floor: entry.floor,
        emoji: CHALLENGER_EMOJI[i % CHALLENGER_EMOJI.length] ?? "🐱",
      })),
    [leaderboard],
  );

  const canContinue = outcome === "in_progress" && turn > 0;

  const openHelp = () => {
    setSettingsOpen(false);
    setHelpOpen(true);
  };
  const openSettings = () => {
    setHelpOpen(false);
    setSettingsOpen(true);
  };
  const openName = () => setNamePromptOpen(true);

  return (
    <>
      {/* Global temple background — fixed full-viewport so it covers regardless
          of how wide the playing-mode <main> is capped to. */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage: `url(${screen === "title" ? bgUkuPacha : bgDungeon})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          zIndex: 0,
        }}
      />
      {/* Dark gradient overlay — keeps text/icons legible without crushing the
          torchlit colors. Slightly heavier on the title to support the hero
          headline. */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          background:
            screen === "title"
              ? "linear-gradient(180deg, rgba(8,5,3,0.72) 0%, rgba(8,5,3,0.55) 35%, rgba(8,5,3,0.78) 100%)"
              : "linear-gradient(180deg, rgba(8,5,3,0.55) 0%, rgba(8,5,3,0.40) 50%, rgba(8,5,3,0.65) 100%)",
          zIndex: 0,
        }}
      />
      <main
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          height: "100%",
          maxHeight: "100dvh",
          width: "100%",
          maxWidth: screen === "title" ? "none" : 900,
          margin: "0 auto",
          padding:
            "env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)",
          boxSizing: "border-box",
          overflow: "hidden",
          color: COLORS.text,
          fontFamily: FONTS.body,
        }}
      >
        {screen === "title" ? (
        <TitleScreen
          playerName={playerName}
          topRuns={topRunsForCards}
          canContinue={canContinue}
          onStart={startRunWithRequiredName}
          onOpenHelp={openHelp}
          onOpenSettings={openSettings}
          onOpenName={openName}
        />
      ) : (
        <>
          <PlayingHeader
            floorIndex={floorIndex}
            score={score}
            onMenu={returnToMenu}
            onSettings={openSettings}
          />
          <GridView
            animSpeed={animSpeed}
            legalMoveOpacity={legalMoveOpacity}
            onMove={onGridMove}
          />
          <HUD
            playerName={playerName}
            onTryAgain={tryAgain}
            onMainMenu={returnToMenu}
            tutorialPotionGate={tutorial?.mode === "bag" && !bagPotionConsumed}
          />
        </>
      )}

      {tutorial !== null && screen === "playing" && (
        <TutorialOverlay
          tutorial={tutorial}
          nextDisabled={tutorial.mode === "bag" && tutorial.step === 1 && !bagPotionConsumed}
          nextLabel={
            tutorial.mode === "bag" && tutorial.step === 1 && !bagPotionConsumed ? t("tutorial.usePotion") : undefined
          }
          onNext={() =>
            setTutorial((cur) => {
              if (!cur) return null;
              const steps = cur.mode === "intro" ? INTRO_TUTORIAL_STEPS : BAG_TUTORIAL_STEPS;
              const next = cur.step + 1;
              if (cur.mode === "bag" && next === 1) {
                window.dispatchEvent(new Event("ui:openInventory"));
              }
              if (next >= steps.length) {
                if (cur.mode === "intro") {
                  closeInventory(true);
                  setTutorialPendingBag(true);
                  return null;
                }
                try {
                  localStorage.setItem(TUTORIAL_SEEN_KEY, "1");
                } catch {}
                closeInventory(true);
                return null;
              }
              return { ...cur, step: next };
            })
          }
          onSkip={() => {
            if (tutorial.mode === "bag" && !bagPotionConsumed) {
              useRunStore.getState().capTutorialPotions(2);
            }
            try {
              localStorage.setItem(TUTORIAL_SEEN_KEY, "1");
            } catch {}
            closeInventory(true);
            setTutorialPendingBag(false);
            setTutorial(null);
          }}
        />
      )}

      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
      {settingsOpen && (
        <SettingsModal
          animSpeed={animSpeed}
          swipeSensitivity={swipeSensitivity}
          legalMoveOpacity={legalMoveOpacity}
          hapticsEnabled={hapticsEnabled}
          playerName={playerName}
          onClose={() => setSettingsOpen(false)}
          onAnimSpeed={updateAnimSpeed}
          onSwipe={updateSwipeSensitivity}
          onLegalMoveOpacity={updateLegalMoveOpacity}
          onHaptics={updateHapticsEnabled}
          onEditName={() => setNamePromptOpen(true)}
          onReset={resetSettings}
          onResetTutorial={resetTutorial}
          localeFlag={localeFlag}
        />
      )}
      {namePromptOpen && (
        <NamePromptModal
          draft={nameDraft}
          onChange={setNameDraft}
          onClose={() => setNamePromptOpen(false)}
          onSave={savePlayerName}
        />
      )}
      </main>
    </>
  );
}

function PlayingHeader({
  floorIndex,
  score,
  onMenu,
  onSettings,
}: {
  floorIndex: number;
  score: number;
  onMenu: () => void;
  onSettings: () => void;
}) {
  return (
    <header
      data-tutorial="header"
      style={{
        padding: "8px 10px 6px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        flexShrink: 0,
        background: "rgba(14, 10, 8, 0.55)",
        backdropFilter: "blur(8px) saturate(1.1)",
        WebkitBackdropFilter: "blur(8px) saturate(1.1)",
        borderBottom: `1px solid ${COLORS.borderSubtle}`,
      }}
    >
      <button
        data-tutorial="menu"
        onClick={onMenu}
        title={t("runOver.menu")}
        style={{
          ...pixelChip,
          padding: "6px 10px",
          fontFamily: FONTS.body,
          fontSize: 14,
          letterSpacing: 0,
        }}
      >
        ☰
      </button>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          fontFamily: FONTS.display,
          fontSize: 9,
          letterSpacing: "0.16em",
        }}
      >
        <span>
          <span style={{ color: COLORS.textMuted, marginRight: 6 }}>{t("hud.floorLabel")}</span>
          {floorIndex + 1}
        </span>
        <span style={{ color: COLORS.text }}>{t("app.title")}</span>
        <span>
          <span style={{ color: COLORS.textMuted, marginRight: 6 }}>🏆</span>
          {score}
        </span>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          data-tutorial="settings"
          onClick={onSettings}
          title={t("header.settingsLabel")}
          style={{
            ...pixelChip,
            padding: "6px 10px",
            fontFamily: FONTS.body,
            fontSize: 14,
            letterSpacing: 0,
          }}
        >
          ⚙
        </button>
      </div>
    </header>
  );
}

const INTRO_TUTORIAL_STEPS = [
  { target: "[data-grid-host='true']", titleKey: "tutorial.intro1.title", bodyKey: "tutorial.intro1.body" },
  { target: "[data-tutorial='hp']", titleKey: "tutorial.intro2.title", bodyKey: "tutorial.intro2.body" },
  { target: "[data-grid-host='true']", titleKey: "tutorial.intro3.title", bodyKey: "tutorial.intro3.body" },
] as const;

const BAG_TUTORIAL_STEPS = [
  { target: "[data-tutorial='bag']", titleKey: "tutorial.bag1.title", bodyKey: "tutorial.bag1.body" },
  { target: "[data-tutorial='potion']", titleKey: "tutorial.bag2.title", bodyKey: "tutorial.bag2.body" },
] as const;

function TutorialOverlay({
  tutorial,
  nextDisabled,
  nextLabel,
  onNext,
  onSkip,
}: {
  tutorial: { mode: "intro" | "bag"; step: number };
  nextDisabled?: boolean;
  nextLabel?: string;
  onNext: () => void;
  onSkip: () => void;
}) {
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const steps = tutorial.mode === "intro" ? INTRO_TUTORIAL_STEPS : BAG_TUTORIAL_STEPS;
  const step = Math.max(0, Math.min(steps.length - 1, tutorial.step));
  const conf = steps[step]!;
  const dockTop = rect ? rect.y > window.innerHeight * 0.55 : false;
  const interceptTarget =
    (tutorial.mode === "intro" && (step === 0 || step === 1)) || (tutorial.mode === "bag" && step === 0);

  useEffect(() => {
    const update = () => {
      const el = document.querySelector(conf.target);
      if (!el || !(el instanceof HTMLElement)) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      const pad = 6;
      setRect({ x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, { passive: true });
    const id = window.setInterval(update, 120);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update);
      window.clearInterval(id);
    };
  }, [conf.target]);

  return (
    <div
      data-swipe-exempt="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9,
        pointerEvents: "none",
      }}
    >
      {rect ? (
        <>
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              right: 0,
              height: rect.y,
              background: "rgba(8, 5, 3, 0.72)",
              pointerEvents: "auto",
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: 0,
              top: rect.y,
              width: rect.x,
              height: rect.h,
              background: "rgba(8, 5, 3, 0.72)",
              pointerEvents: "auto",
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: rect.x + rect.w,
              top: rect.y,
              right: 0,
              height: rect.h,
              background: "rgba(8, 5, 3, 0.72)",
              pointerEvents: "auto",
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: 0,
              top: rect.y + rect.h,
              right: 0,
              bottom: 0,
              background: "rgba(8, 5, 3, 0.72)",
              pointerEvents: "auto",
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: rect.x,
              top: rect.y,
              width: rect.w,
              height: rect.h,
              borderRadius: 12,
              boxShadow: `0 0 0 2px ${COLORS.win}, 0 0 34px rgba(93, 208, 230, 0.35)`,
              pointerEvents: "none",
              zIndex: 1,
            }}
          />
          {interceptTarget && (
            <div
              role="button"
              tabIndex={0}
              aria-label="tutorial target"
              onPointerDown={(e) => {
                e.preventDefault();
                if (tutorial.mode === "bag" && step === 0) {
                  window.dispatchEvent(new Event("ui:openInventory"));
                }
                onNext();
              }}
              style={{
                position: "absolute",
                left: rect.x,
                top: rect.y,
                width: rect.w,
                height: rect.h,
                borderRadius: 12,
                background: "transparent",
                pointerEvents: "auto",
                zIndex: 2,
              }}
            />
          )}
        </>
      ) : (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(8, 5, 3, 0.72)",
            pointerEvents: "auto",
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          ...(dockTop ? { top: "env(safe-area-inset-top)" } : { bottom: "env(safe-area-inset-bottom)" }),
          padding: 16,
          display: "grid",
          placeItems: "center",
          boxSizing: "border-box",
          pointerEvents: "auto",
          zIndex: 3,
        }}
      >
        <div
          style={{
            width: "min(560px, 100%)",
            background: "rgba(20, 14, 8, 0.9)",
            backdropFilter: "blur(18px) saturate(1.25)",
            WebkitBackdropFilter: "blur(18px) saturate(1.25)",
            ...pixelBorder(COLORS.win, 2),
            padding: "16px 16px 14px",
            color: COLORS.text,
            boxShadow: "0 0 0 4px rgba(0, 0, 0, 0.4)",
          }}
        >
          <div style={{ ...sectionLabel, color: COLORS.win }}>{t(conf.titleKey)}</div>
          <div style={{ marginTop: 10, fontFamily: FONTS.body, fontSize: 13, color: COLORS.text }}>
            {t(conf.bodyKey)}
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "space-between", marginTop: 14, flexWrap: "wrap" }}>
            <button onClick={onSkip} style={{ ...pixelButtonGhost, padding: "10px 16px" }}>
              {t("tutorial.skip")}
            </button>
            <button
              onClick={onNext}
              disabled={nextDisabled === true}
              style={{ ...pixelButtonPrimary, fontSize: 11, opacity: nextDisabled ? 0.6 : 1 }}
            >
              {nextLabel ?? (step >= steps.length - 1 ? t("tutorial.done") : t("tutorial.next"))}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModalShell({
  title,
  onClose,
  children,
  width,
  rightActions,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number | string;
  rightActions?: React.ReactNode;
}) {
  return (
    <div onClick={onClose} style={modalBackdrop}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          ...modalPanel,
          width: width ?? "min(560px, 100%)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div
            style={{
              fontFamily: FONTS.display,
              fontSize: 11,
              letterSpacing: "0.16em",
              color: COLORS.text,
            }}
          >
            {title}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {rightActions}
            <button
              onClick={onClose}
              style={{
                ...pixelChip,
                fontFamily: FONTS.display,
                fontSize: 8,
                letterSpacing: "0.18em",
                padding: "6px 10px",
              }}
            >
              ✕ {t("settings.close")}
            </button>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>{children}</div>
      </div>
    </div>
  );
}

function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <ModalShell title={t("help.title")} onClose={onClose}>
      <div
        style={{
          fontSize: 14,
          lineHeight: 1.45,
          color: COLORS.text,
          maxHeight: "70dvh",
          overflowY: "auto",
          paddingRight: 4,
        }}
      >
        {HELP_SECTIONS.map((s) => (
          <section key={s} style={{ marginBottom: 14 }}>
            {s === "lattices" ? (
              <details
                style={{
                  ...pixelBorder(COLORS.borderSubtle, 1),
                  padding: "8px 10px",
                  background: "rgba(7, 4, 16, 0.45)",
                }}
              >
                <summary
                  style={{
                    ...sectionLabel,
                    cursor: "pointer",
                    listStyle: "none",
                    outline: "none",
                  }}
                >
                  {t(`help.section.${s}.title`)}
                  <span style={{ marginLeft: 8, opacity: 0.6, fontSize: 11 }}>
                    {t("help.section.lattices.hint")}
                  </span>
                </summary>
                <div style={{ whiteSpace: "pre-wrap", marginTop: 8, color: COLORS.text }}>
                  {t(`help.section.${s}.body`)}
                </div>
              </details>
            ) : (
              <>
                <div style={{ ...sectionLabel, marginBottom: 6 }}>{t(`help.section.${s}.title`)}</div>
                <div style={{ whiteSpace: "pre-wrap" }}>{t(`help.section.${s}.body`)}</div>
              </>
            )}
          </section>
        ))}
      </div>
    </ModalShell>
  );
}

function SettingsModal({
  animSpeed,
  swipeSensitivity,
  legalMoveOpacity,
  hapticsEnabled,
  playerName,
  onClose,
  onAnimSpeed,
  onSwipe,
  onLegalMoveOpacity,
  onHaptics,
  onEditName,
  onReset,
  onResetTutorial,
  localeFlag,
}: {
  animSpeed: number;
  swipeSensitivity: number;
  legalMoveOpacity: number;
  hapticsEnabled: boolean;
  playerName: string;
  onClose: () => void;
  onAnimSpeed: (v: number) => void;
  onSwipe: (v: number) => void;
  onLegalMoveOpacity: (v: number) => void;
  onHaptics: (v: boolean) => void;
  onEditName: () => void;
  onReset: () => void;
  onResetTutorial: () => void;
  localeFlag: (l: ReturnType<typeof getLocale>) => string;
}) {
  return (
    <ModalShell title={t("settings.title")} onClose={onClose}>
      <div style={{ display: "grid", gap: 14, fontSize: 14, lineHeight: 1.45 }}>
        <SettingRow label={t("settings.language")}>
          <select
            value={getLocale()}
            onChange={(e) => setLocale(e.target.value as (typeof LOCALES)[number])}
            style={{
              background: COLORS.bgSunkenSolid,
              color: COLORS.text,
              ...pixelBorder(COLORS.borderSubtle, 1),
              padding: "6px 10px",
              fontFamily: FONTS.body,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            {LOCALES.map((loc) => (
              <option key={loc} value={loc}>
                {localeFlag(loc)} {loc.toUpperCase()}
              </option>
            ))}
          </select>
        </SettingRow>

        <SettingRow label={t("settings.playerName")}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: COLORS.textMuted }}>{playerName.trim() || "Player"}</span>
            <button onClick={onEditName} style={{ ...pixelButtonGhost, padding: "5px 10px", fontSize: 12 }}>
              {t("settings.editName")}
            </button>
          </div>
        </SettingRow>

        <SliderRow
          label={t("settings.animSpeed")}
          value={animSpeed}
          min={0.2}
          max={2}
          step={0.05}
          onChange={onAnimSpeed}
        />
        <SliderRow
          label={t("settings.swipeSensitivity")}
          value={swipeSensitivity}
          min={0.5}
          max={2}
          step={0.05}
          onChange={onSwipe}
        />
        <SliderRow
          label={t("settings.legalMoveOpacity")}
          value={legalMoveOpacity}
          min={0.05}
          max={1}
          step={0.05}
          onChange={onLegalMoveOpacity}
        />

        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={hapticsEnabled}
            onChange={(e) => onHaptics(e.target.checked)}
          />
          <span style={{ color: COLORS.textMuted }}>{t("settings.haptics")}</span>
        </label>

        <button
          onClick={onReset}
          style={{ ...pixelButtonGhost, marginTop: 6, padding: "10px 12px", fontSize: 13 }}
        >
          {t("settings.reset")}
        </button>

        {import.meta.env.DEV && (
          <button
            onClick={onResetTutorial}
            style={{ ...pixelButtonGhost, padding: "10px 12px", fontSize: 13, ...pixelBorder(COLORS.win, 1) }}
          >
            {t("settings.resetTutorial")}
          </button>
        )}
      </div>
    </ModalShell>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <div style={{ ...sectionLabel, color: COLORS.text }}>{label}</div>
      {children}
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ ...sectionLabel, color: COLORS.text }}>{label}</div>
        <div style={{ color: COLORS.textMuted, fontFamily: FONTS.mono }}>{value.toFixed(2)}</div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: COLORS.primary }}
      />
    </div>
  );
}

function NamePromptModal({
  draft,
  onChange,
  onClose,
  onSave,
}: {
  draft: string;
  onChange: (v: string) => void;
  onClose: () => void;
  onSave: (v: string) => void;
}) {
  const canSave = draft.trim() !== "";
  return (
    <ModalShell title={t("namePrompt.title")} onClose={onClose} width="min(420px, 100%)">
      <div style={{ display: "grid", gap: 12 }}>
        <input
          value={draft}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t("namePrompt.placeholder")}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && canSave) onSave(draft);
          }}
          style={{
            width: "100%",
            background: COLORS.bgSunkenSolid,
            color: COLORS.text,
            ...pixelBorder(COLORS.borderSubtle, 1),
            padding: "10px 12px",
            fontFamily: FONTS.body,
            fontSize: 16,
            boxSizing: "border-box",
          }}
        />
        {!canSave && (
          <div
            role="status"
            style={{
              color: COLORS.death,
              fontFamily: FONTS.display,
              fontSize: 9,
              letterSpacing: "0.16em",
            }}
          >
            {t("namePrompt.required")}
          </div>
        )}
        <button
          onClick={() => onSave(draft)}
          disabled={!canSave}
          style={{ ...pixelButtonPrimary, fontSize: 11 }}
        >
          {t("namePrompt.save")}
        </button>
      </div>
    </ModalShell>
  );
}
