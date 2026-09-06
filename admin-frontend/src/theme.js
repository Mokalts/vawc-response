/**
 * VAWC-Response Admin Portal - Design System
 * Violet primary · Orange highlights · Pink+Sky supporting.
 * Tiered radius: cards/logos/avatars rounded, utility (buttons/inputs/sections) sharp-ish.
 */

// ─── Color Tokens ─────────────────────────────────────────────────────────────
export const COLORS = {
  // Primary - orange (brand, main actions, active states)
  primary:        "#F47920",   // orange-500, primary brand
  primaryLight:   "#FF9A4D",   // orange light, accent
  primaryBg:      "var(--adm-primary-bg)",   // orange tint (theme-aware: peach in light, dark-orange in dark)
  primaryBorder:  "#FFCC99",   // orange-200

  // Secondary - violet (accents, secondary actions, super-admin)
  secondary:      "#7B2D8B",   // violet-700
  secondaryDark:  "#4A1259",   // violet-deep
  secondaryBg:    "#F3E5F5",   // violet-50
  secondaryBorder:"#E1BEE7",   // violet-200

  // Pink - VAWC / RA 9262 awareness
  pink:           "#EC4899",   // pink-500
  pinkDark:       "#BE185D",   // pink-700
  pinkBg:         "#FDF2F8",   // pink-50
  pinkBorder:     "#FBCFE8",   // pink-200

  // Sky - info / trust
  sky:            "#9B4DAB",
  skyDark:        "#7B2D8B",
  skyBg:          "#F3E5F5",
  skyBorder:      "#E1BEE7",

  // Surface — theme-aware (flip in dark; see GLOBAL_CSS :root / [data-theme=dark])
  white:        "#FFFFFF",
  bgPage:       "var(--adm-page)",
  bgCard:       "var(--adm-card)",
  bgMuted:      "var(--adm-muted)",

  // Borders — theme-aware
  border:       "var(--adm-border)",
  borderStrong: "var(--adm-border-strong)",

  // Text — theme-aware
  textPrimary:  "var(--adm-text)",
  textSecondary:"var(--adm-text-2)",
  textMuted:    "var(--adm-text-muted)",
  textInverse:  "#FFFFFF",

  // Status
  status: {
    submitted:             { label: "Submitted",             color: "#BE185D", bg: "#FDF2F8", border: "#FBCFE8", dot: "#EC4899" },
    awaiting_onsite_visit: { label: "Awaiting Onsite Visit", color: "#92400E", bg: "#FFFBEB", border: "#FDE68A", dot: "#F59E0B" },
    summon_issued:         { label: "Summons Issued",        color: "#C45E10", bg: "#FFF3E0", border: "#FFCC99", dot: "#F47920" },
    summon_acknowledged:   { label: "Respondent Appeared",   color: "#4A1259", bg: "#F3E5F5", border: "#E1BEE7", dot: "#9B4DAB" },
    resolved:              { label: "Resolved",              color: "#065F46", bg: "#ECFDF5", border: "#A7F3D0", dot: "#10B981" },
    cfa_issued:            { label: "CFA Issued",            color: "#92400E", bg: "#FFFBEB", border: "#FDE68A", dot: "#D97706" },
    endorsed:              { label: "Endorsed",              color: "#991B1B", bg: "#FEF2F2", border: "#FECACA", dot: "#EF4444" },
    referred_to_police:    { label: "Referred to Authorities", color: "#991B1B", bg: "#FEF2F2", border: "#FECACA", dot: "#EF4444" },
  },

  // Utility
  success:      "#059669",
  successBg:    "#ECFDF5",
  danger:       "#E11D48",
  dangerBg:     "#FEF2F2",
  warning:      "#D97706",
  warningBg:    "#FFFBEB",
  info:         "#C45E10",
  infoBg:       "#FFF3E0",
};

// ─── Typography ───────────────────────────────────────────────────────────────
export const TEXT = {
  font:       "'Lexend', sans-serif",
  pageTitle:  { fontSize: 20, fontWeight: 700, color: COLORS.textPrimary, fontFamily: "'Lexend', sans-serif", letterSpacing: "-0.3px" },
  cardTitle:  { fontSize: 13, fontWeight: 700, color: COLORS.textPrimary, fontFamily: "'Lexend', sans-serif", textTransform: "uppercase", letterSpacing: "0.6px" },
  body:       { fontSize: 13.5, fontWeight: 400, color: COLORS.textSecondary, fontFamily: "'Lexend', sans-serif", lineHeight: 1.6 },
  label:      { fontSize: 11, fontWeight: 700, color: COLORS.textMuted, fontFamily: "'Lexend', sans-serif", textTransform: "uppercase", letterSpacing: "0.7px" },
  small:      { fontSize: 12, fontWeight: 400, color: COLORS.textMuted, fontFamily: "'Lexend', sans-serif" },
};

// ─── Spacing ──────────────────────────────────────────────────────────────────
export const SPACE = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };

// ─── Radius - tiered ──────────────────────────────────────────────────────────
//   none  = 0     → page sections, table cells, navbars
//   sm    = 4     → small badges/tags
//   md    = 8     → buttons, inputs, small icon boxes, sidebar nav items
//   lg    = 12    → cards, widgets, panels
//   xl    = 16    → hero cards, large modals
//   pill  = 9999  → status pills, count badges
//   circle= '50%' → avatars, dots, spinners
export const RADIUS = {
  none:   0,
  sm:     4,
  md:     8,
  lg:     12,
  xl:     16,
  pill:   9999,
  circle: "50%",
};

// ─── Shadows ──────────────────────────────────────────────────────────────────
export const SHADOW = {
  sm:   "0 1px 3px rgba(15,23,42,0.08)",
  md:   "0 2px 8px rgba(15,23,42,0.08)",
  lg:   "0 4px 16px rgba(15,23,42,0.10)",
  card: "0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)",
};

// ─── Card Styles ──────────────────────────────────────────────────────────────
export const CARD = {
  base: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    border: `1px solid ${COLORS.border}`,
    boxShadow: "var(--adm-card-shadow)",
    overflow: "hidden",
    fontFamily: TEXT.font,
  },
  header: {
    padding: "14px 20px",
    borderBottom: `1px solid ${COLORS.border}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.bgMuted,
  },
  accent: { width: 3, height: 16, borderRadius: 2, backgroundColor: COLORS.primary, flexShrink: 0 },
  body:   { padding: "20px" },
};

// ─── Button Styles ────────────────────────────────────────────────────────────
export const BTN = {
  primary: {
    padding: "9px 18px", borderRadius: RADIUS.md, border: "none",
    background: COLORS.primary, color: COLORS.white,
    fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: TEXT.font,
    display: "inline-flex", alignItems: "center", gap: 7,
    boxShadow: "0 1px 3px rgba(196,94,16,0.25)",
  },
  secondary: {
    padding: "8px 16px", borderRadius: RADIUS.md,
    border: `1.5px solid ${COLORS.border}`, background: COLORS.bgCard, color: COLORS.textSecondary,
    fontSize: 13.5, fontWeight: 500, cursor: "pointer", fontFamily: TEXT.font,
    display: "inline-flex", alignItems: "center", gap: 7,
  },
  // Orange - for primary "Report" CTA / urgent action
  accent: {
    padding: "9px 18px", borderRadius: RADIUS.md, border: "none",
    background: COLORS.secondary, color: COLORS.white,
    fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: TEXT.font,
    display: "inline-flex", alignItems: "center", gap: 7,
    boxShadow: "0 1px 3px rgba(196,94,16,0.25)",
  },
  danger: {
    padding: "8px 16px", borderRadius: RADIUS.md,
    border: `1.5px solid #FECACA`, background: COLORS.dangerBg, color: COLORS.danger,
    fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: TEXT.font,
    display: "inline-flex", alignItems: "center", gap: 7,
  },
  success: {
    padding: "8px 16px", borderRadius: RADIUS.md,
    border: `1.5px solid #A7F3D0`, background: COLORS.successBg, color: COLORS.success,
    fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: TEXT.font,
    display: "inline-flex", alignItems: "center", gap: 7,
  },
  ghost: {
    padding: "6px 12px", borderRadius: RADIUS.md, border: "none",
    background: "transparent", color: COLORS.primary,
    fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: TEXT.font,
  },
};

// ─── Table Styles ─────────────────────────────────────────────────────────────
export const TABLE = {
  table: { width: "100%", borderCollapse: "collapse", fontFamily: TEXT.font },
  th: {
    padding: "10px 16px", textAlign: "left",
    fontSize: 11, fontWeight: 700, color: COLORS.textMuted,
    textTransform: "uppercase", letterSpacing: "0.7px",
    backgroundColor: COLORS.bgMuted,
    borderBottom: `2px solid ${COLORS.border}`,
    whiteSpace: "nowrap",
  },
  td: {
    padding: "13px 16px", fontSize: 13.5,
    color: COLORS.textSecondary, borderBottom: `1px solid ${COLORS.bgMuted}`,
    fontFamily: TEXT.font,
  },
};

// ─── Status Pill ──────────────────────────────────────────────────────────────
export const statusPill = (rawStatus) => {
  const cfg = COLORS.status[rawStatus] || {
    label: rawStatus || "Unknown",
    color: COLORS.textMuted, bg: COLORS.bgMuted, border: COLORS.border, dot: COLORS.borderStrong,
  };
  return {
    style: {
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: RADIUS.pill,
      fontSize: 11.5, fontWeight: 600,
      color: cfg.color, backgroundColor: cfg.bg,
      border: `1px solid ${cfg.border}`,
      fontFamily: TEXT.font, whiteSpace: "nowrap",
    },
    dotStyle: {
      width: 6, height: 6, borderRadius: RADIUS.circle,
      backgroundColor: cfg.dot, flexShrink: 0,
    },
    label: cfg.label,
  };
};

// ─── Input Styles ─────────────────────────────────────────────────────────────
export const INPUT = {
  base: {
    width: "100%", padding: "9px 12px", borderRadius: RADIUS.md,
    border: `1.5px solid ${COLORS.border}`,
    fontSize: 13.5, color: COLORS.textPrimary, backgroundColor: COLORS.bgMuted,
    fontFamily: TEXT.font, outline: "none", boxSizing: "border-box",
  },
};

// ─── Global CSS string (inject once) ─────────────────────────────────────────
export const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700;800&display=swap');

  /* ── Theme tokens (light default; flipped by data-theme="dark" on <html>) ── */
  :root {
    --adm-page:#F4F6F9; --adm-card:#FFFFFF; --adm-muted:#F8FAFC;
    --adm-border:#E2E8F0; --adm-border-strong:#CBD5E1;
    --adm-text:#0F172A; --adm-text-2:#475569; --adm-text-muted:#94A3B8;
    --adm-primary-bg:#FFF3E0;
    --adm-topbar:rgba(255,255,255,0.82); --adm-card-shadow:0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04);
  }
  :root[data-theme="dark"] {
    --adm-page:#0F1216; --adm-card:#181C22; --adm-muted:#1E232B;
    --adm-border:#2B323C; --adm-border-strong:#3C4551;
    --adm-text:#EAEEF3; --adm-text-2:#B6C0CD; --adm-text-muted:#8B95A3;
    --adm-primary-bg:#33251A;
    --adm-topbar:rgba(22,26,32,0.82); --adm-card-shadow:0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3);
  }

  *, *::before, *::after { box-sizing: border-box; }

  body {
    font-family: 'Lexend', sans-serif;
    background-color: ${COLORS.bgPage};
    color: ${COLORS.textPrimary};
    margin: 0;
    -webkit-font-smoothing: antialiased;
  }

  /* Scrollbar */
  ::-webkit-scrollbar       { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: ${COLORS.bgPage}; }
  ::-webkit-scrollbar-thumb { background: ${COLORS.borderStrong}; border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: ${COLORS.primary}; }

  /* Table row hover */
  .adm-row:hover td { background: ${COLORS.primaryBg} !important; cursor: pointer; }
  .adm-row td       { transition: background 0.1s ease; }

  /* Button transitions */
  .adm-btn { transition: all 0.15s ease; }
  .adm-btn:hover:not([disabled]) { transform: translateY(-1px); opacity: 0.92; }
  .adm-btn:active:not([disabled]) { transform: translateY(0); }

  /* Input focus */
  .adm-input:focus {
    border-color: ${COLORS.primary} !important;
    background: ${COLORS.white} !important;
    box-shadow: 0 0 0 3px rgba(244,121,32,0.15);
  }

  /* Animations */
  @keyframes adm-fadeUp   { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  @keyframes adm-shimmer  { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
  @keyframes adm-spin     { to{transform:rotate(360deg)} }
  @keyframes adm-slideDown{ from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes adm-popIn    { from{opacity:0;transform:scale(0.96) translateY(10px)} to{opacity:1;transform:scale(1) translateY(0)} }
`;

// ─── ID Badge ────────────────────────────────────────────────────────────────
export const ID_BADGE = {
  display: "inline-block", padding: "2px 8px", borderRadius: RADIUS.sm,
  fontSize: 12, fontWeight: 700,
  color: COLORS.primary, backgroundColor: COLORS.primaryBg,
  fontFamily: "monospace", border: `1px solid ${COLORS.primaryBorder}`,
};

// ─── Page wrapper ─────────────────────────────────────────────────────────────
export const PAGE = {
  wrap:   { maxWidth: 1200, fontFamily: TEXT.font },
  topRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 },
};
