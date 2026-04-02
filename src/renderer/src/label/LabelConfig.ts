// src/renderer/src/label/LabelConfig.ts
// ============================================================
// SINGLE SOURCE OF TRUTH FOR ALL LABEL DIMENSIONS & SETTINGS
// ============================================================
// Change values here → all previews, print outputs, and
// PNG exports update automatically.

export const LABEL = {
  // ── Physical dimensions (mm) ─────────────────────────────
  WIDTH_MM:  100,
  HEIGHT_MM:  45,

  // ── Pixel canvas dimensions (base, unscaled) ─────────────
  // These define the "native" pixel size of the label.
  // All rendering is done at this resolution; consumers scale
  // it with CSS `zoom` or `transform: scale()`.
  WIDTH_PX:  420,
  HEIGHT_PX: 160,

  // ── Print DPI override ───────────────────────────────────
  // Used to compute scale factor when sending to printer.
  // 96 dpi = CSS px. At 300 dpi a 100mm label ≈ 1181px;
  // we map our 420px canvas to that via CSS.
  PRINT_DPI: 300,

  // ── PNG export scale ─────────────────────────────────────
  PNG_SCALE: 3,

  // ── Layout padding (px) ──────────────────────────────────
  PADDING_TOP:    10,
  PADDING_RIGHT:   6,
  PADDING_BOTTOM:  6,
  PADDING_LEFT:    4,

  // ── Barcode ──────────────────────────────────────────────
  BARCODE: {
    WIDTH:        1.15,   // bar width multiplier
    HEIGHT:       28,     // px
    FONT_SIZE:     8,     // px
    TEXT_MARGIN:   1,     // px
    MARGIN:        1,     // px
  },

  // ── QR code ──────────────────────────────────────────────
  QR: {
    SIZE:   64,  // px (width & height)
    MARGIN:  1,  // quiet zone modules
  },

  // ── Typography ───────────────────────────────────────────
  FONTS: {
    FAMILY:       "'Space Grotesk', Arial, sans-serif",
    MODEL_SIZE:    11,   // px – model/storage/code title row
    MODEL_WEIGHT:  800,
    ROW_SIZE:       9,   // px – inside info boxes
    ROW_WEIGHT:   600,
    BADGE_SIZE:    10,   // px – EU+/DU+ text
    BADGE_WEIGHT:  900,
  },

  // ── Info box layout ──────────────────────────────────────
  BOX: {
    BORDER:       '1px solid #888',
    BORDER_RADIUS: 4,    // px
    PADDING_X:     5,    // px
    PADDING_Y:     3,    // px
    GAP:           4,    // px gap between boxes
  },

  // ── Badge (EU+ / DU+) ────────────────────────────────────
  BADGE: {
    SIZE:          38,   // px diameter
    BORDER_WIDTH:   2,   // px
  },

  // ── Logo ─────────────────────────────────────────────────
  LOGO: {
    WIDTH:  42,  // px
    HEIGHT: 38,  // px
  },

  // ── QR URL ───────────────────────────────────────────────
  QR_URL: 'https://www.latsonsorginals.com/',
} as const

// Derived: padding shorthand (used in inline styles)
export const LABEL_PADDING = `${LABEL.PADDING_TOP}px ${LABEL.PADDING_RIGHT}px ${LABEL.PADDING_BOTTOM}px ${LABEL.PADDING_LEFT}px`