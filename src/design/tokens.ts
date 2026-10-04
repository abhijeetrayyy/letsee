/**
 * The tokens from `tokens.css`, as hex, for places a CSS variable cannot reach:
 * toast options set in JavaScript, chart.js datasets, and the html2canvas
 * share cards (html2canvas 1.4 cannot read `var()`, OKLCH or `color-mix`).
 *
 * Keep in step with `tokens.css`; `tests/invariants/token-contrast.test.ts`
 * fails if the two disagree. Fourth pass: paper and screen — the light palette (dark lives in tokens.css under data-theme="dark").
 */
export const TOKENS = {
  page: "#f6f5f1",
  raised: "#ffffff",
  overlay: "#ffffff",
  hover: "#ecebe5",
  active: "#e1e0d9",
  line: "#e7e5df",
  lineStrong: "#d8d6cf",
  lineInput: "#85837d",
  ink0: "#141414",
  ink200: "#1d1d1c",
  ink300: "#2f2f2d",
  ink400: "#4a4946",
  ink500: "#67655f",
  action: "#1ccf68",
  onAction: "#04150b",
  accent: "#0a7a3c",
  accentStrong: "#0a7a3c",
  focus: "#0a7a3c",
  danger: "#b3261f",
  rating: "#0a7a3c",
} as const;

export type TokenName = keyof typeof TOKENS;

/**
 * The dark palette's few values a JS consumer needs: the share cards are
 * always dark (they are pictures of films), whatever the app's theme, and
 * html2canvas reads their inline gradients as literal colours; charts and the
 * diary calendar pick these when the app is dark (`isDarkTheme`).
 */
export const TOKENS_DARK = {
  page: "#0f1011",
  raised: "#18191b",
  active: "#35363a",
  lineStrong: "#303134",
  lineInput: "#6d6e72",
  ink0: "#f5f5f3",
  ink400: "#bdbdb9",
  ink500: "#9a9a96",
  accent: "#3ddc80",
} as const;

/**
 * A token at an opacity, as `rgba()`, for inline styles, gradients and canvas
 * — the places a class with `/50` cannot go. Literal colours live here and
 * nowhere else in components (the design ratchet counts them).
 */
export function alpha(hex: string, opacity: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${opacity})`;
}

/** Pure black and white, for masks and shadows: an opacity, not a colour on screen. */
export const SHADE = "#000000";
export const LIGHT = "#ffffff";
