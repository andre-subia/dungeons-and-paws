/**
 * Design tokens for the Dungeon and Paws shell, tuned to the Uku Pacha
 * temple-chamber background: warm dark stone, copper edges, torchlight
 * amber, magical cyan rune-glow, and a warm cream text tone. UI panels
 * use translucent fills + backdrop blur so the temple shows through.
 */

import type { CSSProperties } from "react";

export const COLORS = {
  // Backgrounds — translucent so the temple bg shows through. Use *Solid
  // variants only where backdrop-filter doesn't apply (selects, inputs).
  bg: "#0e0a08",
  bgPanel: "rgba(26, 18, 12, 0.78)",
  bgPanelSolid: "#1a120c",
  bgSunken: "rgba(8, 5, 3, 0.78)",
  bgSunkenSolid: "#080503",
  bgElevated: "rgba(58, 40, 26, 0.65)",

  // Borders — copper / antique brass
  border: "#a07a3d",
  borderSubtle: "rgba(232, 200, 140, 0.22)",
  borderDim: "rgba(232, 200, 140, 0.12)",
  divider: "rgba(232, 200, 140, 0.10)",

  // Text — warm cream, torchlit
  text: "#f0e6d0",
  textMuted: "rgba(240, 230, 208, 0.66)",
  textFaint: "rgba(240, 230, 208, 0.38)",

  // Primary — torchlight amber (CTAs, hero accent)
  primary: "#e8a04a",
  primaryDim: "#b87830",
  primaryGlow: "rgba(232, 160, 74, 0.45)",

  // Accent — magical cyan (rune circles, lattice charge)
  accent: "#5dd0e6",
  accentGlow: "rgba(93, 208, 230, 0.42)",

  // Status
  win: "#e8c674",
  death: "#c4585a",
  heart: "#d46060",
} as const;

export const FONTS = {
  display: '"Press Start 2P", "VT323", ui-monospace, monospace',
  body: '"VT323", ui-monospace, monospace',
  mono: 'ui-monospace, "SFMono-Regular", monospace',
} as const;

/** Crisp 1-2px pixel border, configurable color/width. */
export const pixelBorder = (color: string = COLORS.border, width = 1): CSSProperties => ({
  border: `${width}px solid ${color}`,
  borderRadius: 0,
});

/** Glassmorphism base — translucent dark warm fill with backdrop blur. */
export const glass: CSSProperties = {
  background: COLORS.bgPanel,
  backdropFilter: "blur(10px) saturate(1.15)",
  WebkitBackdropFilter: "blur(10px) saturate(1.15)",
  border: `1px solid ${COLORS.borderSubtle}`,
  color: COLORS.text,
  fontFamily: FONTS.body,
};

/** Stronger glass — used for modals and the run-over card. */
export const glassStrong: CSSProperties = {
  background: "rgba(20, 14, 8, 0.85)",
  backdropFilter: "blur(18px) saturate(1.25)",
  WebkitBackdropFilter: "blur(18px) saturate(1.25)",
  border: `2px solid ${COLORS.border}`,
  color: COLORS.text,
  fontFamily: FONTS.body,
};

/** Card-style panel for in-game chrome. */
export const pixelCard: CSSProperties = {
  ...glass,
  border: `2px solid ${COLORS.border}`,
};

/** Subtler bordered card. */
export const pixelCardSubtle: CSSProperties = {
  ...glass,
};

/** Big amber CTA — looks like a glowing torch button. */
export const pixelButtonPrimary: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  background: `linear-gradient(180deg, ${COLORS.primary}, ${COLORS.primaryDim})`,
  color: "#1a0f06",
  border: `2px solid #f0c878`,
  borderRadius: 0,
  padding: "12px 22px",
  fontFamily: FONTS.display,
  fontSize: 12,
  letterSpacing: "0.14em",
  cursor: "pointer",
  textTransform: "uppercase",
  textShadow: "0 1px 0 rgba(255, 220, 160, 0.5)",
  boxShadow: `inset 0 1px 0 rgba(255, 230, 180, 0.6), inset 0 -2px 0 rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.5), 0 0 22px ${COLORS.primaryGlow}`,
};

/** Outline / secondary button. */
export const pixelButtonGhost: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  background: "rgba(20, 14, 8, 0.55)",
  color: COLORS.text,
  border: `1px solid ${COLORS.borderSubtle}`,
  borderRadius: 0,
  padding: "8px 14px",
  fontFamily: FONTS.body,
  fontSize: 14,
  letterSpacing: "0.08em",
  cursor: "pointer",
  textTransform: "uppercase",
  backdropFilter: "blur(6px)",
  WebkitBackdropFilter: "blur(6px)",
};

/** Tiny header chip. */
export const pixelChip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "rgba(20, 14, 8, 0.55)",
  color: COLORS.text,
  border: `1px solid ${COLORS.borderSubtle}`,
  borderRadius: 0,
  padding: "6px 10px",
  fontFamily: FONTS.body,
  fontSize: 12,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  backdropFilter: "blur(6px)",
  WebkitBackdropFilter: "blur(6px)",
};

/** Display heading — pixel font with a warm torchlit glow. */
export const displayHeading: CSSProperties = {
  fontFamily: FONTS.display,
  color: COLORS.text,
  letterSpacing: "0.04em",
  lineHeight: 1.05,
  textShadow: `0 0 18px ${COLORS.primaryGlow}, 0 2px 0 #000`,
};

/** Modal backdrop — slightly darker than the bg overlay. */
export const modalBackdrop: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(8, 5, 3, 0.65)",
  backdropFilter: "blur(4px)",
  WebkitBackdropFilter: "blur(4px)",
  display: "grid",
  placeItems: "center",
  zIndex: 10,
  padding: 16,
  boxSizing: "border-box",
};

/** Standard modal panel. */
export const modalPanel: CSSProperties = {
  width: "min(560px, 100%)",
  ...glassStrong,
  padding: "18px 18px 16px",
  letterSpacing: 0,
  boxShadow: `0 0 0 4px rgba(0, 0, 0, 0.4), 0 0 36px rgba(232, 160, 74, 0.18)`,
};

/** Section label — small, uppercase, tracked. */
export const sectionLabel: CSSProperties = {
  fontFamily: FONTS.display,
  fontSize: 9,
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: COLORS.textMuted,
};
