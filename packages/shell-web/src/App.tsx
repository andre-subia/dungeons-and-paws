import { useCallback, useEffect, useRef, useState } from "react";
import { GridView } from "./components/GridView.js";
import { HUD } from "./components/HUD.js";
import { LOCALES, getLocale, setLocale, subscribeLocaleChange, t } from "./i18n.js";
import { useRunStore } from "./state/store.js";
import { useWebHaptics } from "web-haptics/react";
import type { Cell, RunOutcome } from "@gridlore/engine";

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
const SWIPE_SENSITIVITY_STORAGE_KEY = "gridlore:swipeSensitivity";
const PLAYER_NAME_STORAGE_KEY = "gridlore:playerName";
const PLAYER_ID_STORAGE_KEY = "gridlore:playerId";
const DEFAULT_ANIM_SPEED = 0.7;
const DEFAULT_HAPTICS_ENABLED = true;
const DEFAULT_SWIPE_SENSITIVITY = 1.25;
const DEFAULT_PLAYER_NAME = "";

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "";
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? "";
const LEADERBOARD_TABLE = (import.meta.env.VITE_SUPABASE_LEADERBOARD_TABLE as string | undefined) ?? "leaderboard_entries";
let leaderboardSupportsPlayerId: boolean | null = null;

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
  const writeHeaders = { ...supabaseHeaders(), Prefer: "return=minimal" };
  const readHeaders = { ...supabaseHeaders(), Accept: "application/json" };

  const tryInsertRow = async (row: Record<string, unknown>) => {
    return fetch(baseUrl, {
      method: "POST",
      headers: writeHeaders,
      body: JSON.stringify([row]),
    });
  };

  const tryPatchBy = async (column: string, value: string, body: Record<string, unknown>) => {
    const url = new URL(baseUrl);
    url.searchParams.set(column, `eq.${value}`);
    return fetch(url.toString(), {
      method: "PATCH",
      headers: writeHeaders,
      body: JSON.stringify(body),
    });
  };

  const tryReadBestByPlayerId = async (): Promise<number | null> => {
    const url = new URL(baseUrl);
    url.searchParams.set("select", "score");
    url.searchParams.set("player_id", `eq.${entry.playerId}`);
    url.searchParams.set("limit", "1");
    const res = await fetch(url.toString(), { headers: readHeaders });
    if (!res.ok) {
      if (res.status === 400 || res.status === 404) leaderboardSupportsPlayerId = false;
      return null;
    }
    leaderboardSupportsPlayerId = true;
    const rows = (await res.json()) as Array<{ score: number }>;
    const s = rows[0]?.score;
    return typeof s === "number" && Number.isFinite(s) ? s : null;
  };

  if (leaderboardSupportsPlayerId !== false) {
    const best = await tryReadBestByPlayerId();
    if (best != null && entry.score <= best) return;

    if (leaderboardSupportsPlayerId === true) {
      const patchWithFloor = await tryPatchBy("player_id", entry.playerId, {
        name: entry.name,
        score: entry.score,
        seed: entry.seed,
        outcome: entry.outcome,
        floor: entry.floor,
      });
      if (patchWithFloor.ok) return;

      const patchWithoutFloor = await tryPatchBy("player_id", entry.playerId, {
        name: entry.name,
        score: entry.score,
        seed: entry.seed,
        outcome: entry.outcome,
      });
      if (patchWithoutFloor.ok) return;

      const insertWithFloor = await tryInsertRow({
        player_id: entry.playerId,
        name: entry.name,
        score: entry.score,
        seed: entry.seed,
        outcome: entry.outcome,
        floor: entry.floor,
      });
      if (insertWithFloor.ok) return;

      const insertWithoutFloor = await tryInsertRow({
        player_id: entry.playerId,
        name: entry.name,
        score: entry.score,
        seed: entry.seed,
        outcome: entry.outcome,
      });
      if (insertWithoutFloor.ok) return;
    }
  }

  const url = new URL(baseUrl);
  url.searchParams.set("select", "score");
  url.searchParams.set("name", `eq.${entry.name}`);
  url.searchParams.set("order", "score.desc,created_at.desc");
  url.searchParams.set("limit", "1");
  const byNameRes = await fetch(url.toString(), { headers: readHeaders });
  if (byNameRes.ok) {
    const rows = (await byNameRes.json()) as Array<{ score: number }>;
    const best = rows[0]?.score;
    if (typeof best === "number" && Number.isFinite(best) && entry.score <= best) return;
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

export function App() {
  const [, bump] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [animSpeed, setAnimSpeed] = useState(readAnimSpeed);
  const [hapticsEnabled, setHapticsEnabled] = useState(() => readBool(HAPTICS_STORAGE_KEY, DEFAULT_HAPTICS_ENABLED));
  const [swipeSensitivity, setSwipeSensitivity] = useState(readSwipeSensitivity);
  const [playerId] = useState(readOrCreatePlayerId);
  const [playerName, setPlayerName] = useState(() => readPlayerName() || DEFAULT_PLAYER_NAME);
  const [namePromptOpen, setNamePromptOpen] = useState(() => !readPlayerName());
  const [nameDraft, setNameDraft] = useState(() => readPlayerName());
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const lastRecordedRef = useRef<string>("");
  const { trigger } = useWebHaptics();
  const score = useRunStore((s) => s.state.meta.score);
  const floorIndex = useRunStore((s) => s.state.currentFloor.index);
  const outcome = useRunStore((s) => s.state.outcome);
  const seed = useRunStore((s) => s.state.seed);
  useEffect(() => subscribeLocaleChange(() => bump((x) => x + 1)), []);

  useEffect(() => {
    if (playerName.trim() === "") setNamePromptOpen(true);
  }, [playerName]);

  const refreshLeaderboard = useCallback(async () => {
    if (!hasLeaderboardBackend()) return;
    setLeaderboardLoading(true);
    setLeaderboardError(null);
    try {
      const next = await fetchGlobalLeaderboard(20);
      setLeaderboard(next);
    } catch (e) {
      setLeaderboardError(e instanceof Error ? e.message : String(e));
    } finally {
      setLeaderboardLoading(false);
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
    submitScore({ playerId, name, score, seed, outcome, floor }).then(() => refreshLeaderboard()).catch(() => {});
  }, [floorIndex, outcome, playerId, playerName, refreshLeaderboard, score, seed]);

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
  }, [hapticsEnabled, trigger, swipeSensitivity]);

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

  function updateHapticsEnabled(v: boolean) {
    setHapticsEnabled(v);
    try {
      localStorage.setItem(HAPTICS_STORAGE_KEY, v ? "1" : "0");
    } catch {}
  }

  function savePlayerName(raw: string) {
    const cleaned = raw.trim().slice(0, 18);
    const finalName = cleaned === "" ? "Player" : cleaned;
    setPlayerName(finalName);
    setNameDraft(finalName);
    try {
      localStorage.setItem(PLAYER_NAME_STORAGE_KEY, finalName);
    } catch {}
    setNamePromptOpen(false);
  }

  function resetSettings() {
    setLocale("en");
    updateAnimSpeed(DEFAULT_ANIM_SPEED);
    updateSwipeSensitivity(DEFAULT_SWIPE_SENSITIVITY);
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
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={() => {
              setSettingsOpen(false);
              setHelpOpen(false);
              setLeaderboardOpen(true);
              refreshLeaderboard();
            }}
            title={t("header.leaderboardLabel")}
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
            🌎
          </button>
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
        </div>
      </header>
      <GridView animSpeed={animSpeed} onMove={onGridMove} />
      <HUD playerName={playerName} />

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

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ opacity: 0.85 }}>{t("settings.playerName")}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ opacity: 0.8, letterSpacing: 0 }}>{playerName.trim() || "Player"}</span>
                  <button
                    onClick={() => setNamePromptOpen(true)}
                    style={{
                      background: "transparent",
                      color: "#e9e7d8",
                      border: "1px solid #2a2a3e",
                      borderRadius: 8,
                      padding: "6px 8px",
                      fontFamily: "inherit",
                      fontSize: 12,
                      cursor: "pointer",
                      opacity: 0.95,
                    }}
                  >
                    {t("settings.editName")}
                  </button>
                </div>
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

              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                  <div style={{ opacity: 0.85 }}>{t("settings.swipeSensitivity")}</div>
                  <div style={{ opacity: 0.7, letterSpacing: 0 }}>{swipeSensitivity.toFixed(2)}</div>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={2}
                  step={0.05}
                  value={swipeSensitivity}
                  onChange={(e) => updateSwipeSensitivity(Number(e.target.value))}
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

              <button
                onClick={resetSettings}
                style={{
                  marginTop: 6,
                  background: "transparent",
                  color: "#e9e7d8",
                  border: "1px solid #2a2a3e",
                  borderRadius: 10,
                  padding: "8px 10px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 12,
                  opacity: 0.9,
                }}
              >
                {t("settings.reset")}
              </button>
            </div>
          </div>
        </div>
      )}

      {leaderboardOpen && (
        <div
          onClick={() => setLeaderboardOpen(false)}
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
              <div style={{ fontWeight: 700 }}>{t("leaderboard.title")}</div>
              <div style={{ display: "flex", gap: 8 }}>
                {hasLeaderboardBackend() && (
                  <button
                    onClick={refreshLeaderboard}
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
                    {t("leaderboard.refresh")}
                  </button>
                )}
                <button
                  onClick={() => setLeaderboardOpen(false)}
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
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 8, fontSize: 12, lineHeight: "18px" }}>
              {!hasLeaderboardBackend() ? (
                <div style={{ opacity: 0.75 }}>{t("settings.leaderboardNotConfigured")}</div>
              ) : leaderboardLoading ? (
                <div style={{ opacity: 0.75 }}>{t("settings.leaderboardLoading")}</div>
              ) : leaderboardError ? (
                <div style={{ opacity: 0.75 }}>{t("settings.leaderboardError")}</div>
              ) : leaderboard.length === 0 ? (
                <div style={{ opacity: 0.75 }}>{t("settings.leaderboardEmpty")}</div>
              ) : (
                <div style={{ display: "grid", gap: 6 }}>
                  {leaderboard.slice(0, 20).map((e, idx) => (
                    <div
                      key={`${e.ts}-${e.seed}`}
                      style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12 }}
                    >
                      <span style={{ opacity: 0.9 }}>{`${idx + 1}. ${e.name}`}</span>
                      <span style={{ opacity: 0.8, letterSpacing: 0 }}>
                        {`🏆 ${e.score} · ${t("hud.floorLabel")} ${e.floor}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {namePromptOpen && (
        <div
          onClick={() => setNamePromptOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(11, 11, 20, 0.72)",
            display: "grid",
            placeItems: "center",
            zIndex: 12,
            padding: 16,
            boxSizing: "border-box",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(420px, 100%)",
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
              <div style={{ fontWeight: 700 }}>{t("namePrompt.title")}</div>
              <button
                onClick={() => setNamePromptOpen(false)}
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

            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder={t("namePrompt.placeholder")}
                autoFocus
                style={{
                  width: "100%",
                  background: "#0b0b14",
                  color: "#e9e7d8",
                  border: "1px solid #2a2a3e",
                  borderRadius: 10,
                  padding: "10px 10px",
                  fontFamily: "inherit",
                  fontSize: 14,
                  boxSizing: "border-box",
                }}
              />
              <button
                onClick={() => savePlayerName(nameDraft)}
                style={{
                  background: "#2a2a3e",
                  color: "#e9e7d8",
                  border: "1px solid #2a2a3e",
                  borderRadius: 10,
                  padding: "10px 12px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 14,
                  letterSpacing: "0.06em",
                  opacity: 0.95,
                }}
              >
                {t("namePrompt.save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
