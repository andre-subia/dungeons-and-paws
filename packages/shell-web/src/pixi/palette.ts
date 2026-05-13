import type { Rune } from "@gridlore/engine";

/**
 * Pixi grid palette tuned to the Uku Pacha temple background.
 * The Pixi canvas is rendered with a transparent background — the temple
 * scene shows through the gaps between cards and through the cards' own
 * translucent stone fills. Borders are copper, the selected/exit frames
 * are torchlight amber, and the magical accent (legal-move, charged
 * lattice) is rune cyan to echo the glowing glyphs on the temple floor.
 */
export const COLORS = {
  // bg is unused at runtime (canvas is transparent) but kept as the
  // logical "what shows through the gaps" tone for future fallback use.
  bg: 0x0e0a08,
  cellEmpty: 0x1c130a,
  cellHover: 0x2a1f15,
  cellLegalMove: 0x5dd0e6,
  cellChargedTint: 0x2a4a52,
  cardBorder: 0xa07a3d,
  cardBorderDim: 0x5a4a2a,
  cardBevelHighlight: 0x4a3825,
  cardBevelShadow: 0x080503,
  cardShadow: 0x000000,
  cardInnerFrame: 0xe8c890,
  exitFill: 0x1c130a,
  exitStroke: 0xe8a04a,
  exitLockedFill: 0x1c130a,
  exitLockedStroke: 0xc46060,
  enemyCardFill: 0x1c130a,
  enemyCardStroke: 0x5a4a2a,
  hpStat: 0xd46060,
  attackStat: 0xe8a04a,
  hero: 0xe8c890,
  heroOutline: 0xe8a04a,
  heroCardFill: 0x1c130a,
  cornerStat: 0xf0e6d0,
  text: 0xf0e6d0,
  textOnLight: 0x16100a,
  chamberDivider: 0x5a4a2a,
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
