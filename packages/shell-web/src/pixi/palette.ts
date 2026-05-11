import type { Rune } from "@gridlore/engine";

export const COLORS = {
  bg: 0x0b0b14,
  cellEmpty: 0x232333,
  cellHover: 0x2c2c40,
  cellLegalMove: 0x6989b3,
  cellChargedTint: 0x3a3a55,
  cardBorder: 0x3a3a55,
  cardShadow: 0x000000,
  exitFill: 0x1a3a2a,
  exitStroke: 0x4cd996,
  exitLockedFill: 0x2a2323,
  exitLockedStroke: 0xff6a6a,
  enemyCardFill: 0x2c1f24,
  enemyCardStroke: 0xa53a3a,
  hpStat: 0xff8a8a,
  attackStat: 0xffe19a,
  hero: 0xf6e7a3,
  heroOutline: 0xfff7c2,
  heroCardFill: 0x2a2520,
  cornerStat: 0xe9e7d8,
  text: 0xe9e7d8,
  textOnLight: 0x141420,
  chamberDivider: 0x2a2a3e,
} as const;

export const RUNE_COLORS: Record<Rune, number> = {
  ember: 0xff5a3a,
  tide: 0x4cb8ff,
  bramble: 0x4caf50,
  iron: 0xb0b0c0,
  bone: 0xeee2c1,
  star: 0xffd95a,
  void: 0x8a52d6,
  coin: 0xe7b748,
  blood: 0xa42c2c,
};

/** Single-character glyph per rune. Letters chosen to be unambiguous. */
export const RUNE_GLYPHS: Record<Rune, string> = {
  ember: "E",
  tide: "T",
  bramble: "B",
  iron: "I",
  bone: "K", // K for Skeleton — "B" already taken by Bramble
  star: "S",
  void: "V",
  coin: "C",
  blood: "L", // L for bLood — "B" taken
};

/** Whether a rune's color is light enough to need dark text. */
export const RUNE_NEEDS_DARK_TEXT: Record<Rune, boolean> = {
  ember: false,
  tide: false,
  bramble: false,
  iron: true,
  bone: true,
  star: true,
  void: false,
  coin: true,
  blood: false,
};

/** Big emoji shown center-of-card per rune. */
export const RUNE_EMOJI: Record<Rune, string> = {
  ember: "🔥",
  tide: "💧",
  bramble: "🌿",
  iron: "⚙️",
  bone: "🦴",
  star: "⭐",
  void: "🌑",
  coin: "🪙",
  blood: "🩸",
};

/** Big emoji shown center-of-card per enemy template id. */
export const ENEMY_EMOJI: Record<string, string> = {
  bat: "🦇",
  rat: "🐀",
  snake: "🐍",
  spider: "🕷️",
  skeleton: "💀",
  ghost: "👻",
  slime: "🟢",
};

/** Stat shown in the top-right corner of a rune card (the passive gain
 * the player gets when consuming this tile). null = no resource gain. */
export const RUNE_PASSIVE: Record<Rune, { icon: string; amount: number } | null> = {
  ember: null,
  tide: { icon: "◆", amount: 1 },
  bramble: null,
  iron: { icon: "🛡", amount: 1 },
  bone: { icon: "♥", amount: 1 },
  star: null,
  void: null,
  coin: { icon: "🪙", amount: 1 },
  blood: null,
};

export const HERO_EMOJI = "🐱";
export const EXIT_EMOJI = "🚪";
export const LOCK_EMOJI = "🔒";
export const KEY_EMOJI = "🔑";

export const EMOJI_FONT_FAMILY =
  '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "EmojiOne Color", "Twemoji Mozilla", system-ui, sans-serif';
