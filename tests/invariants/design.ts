/**
 * The design inventory: every styling decision the redesign is replacing,
 * counted.
 *
 * `docs/design/EXECUTION.md` phase 0. Each category below is something the
 * new system forbids or narrows. The ratchet test compares today's totals with
 * `design-baseline.json` and fails if any of them goes up, so the redesign can
 * only ever move forward: a new component that reaches for `text-emerald-400`
 * or a twelfth icon set is caught in CI, not in a screenshot a month later.
 *
 * Pure functions over source text, so the same code serves the test and the
 * baseline writer.
 */
import { read, rel, sourceFiles } from "./schema";

const PREFIX =
  "(?:bg|text|border|ring|from|to|via|fill|stroke|divide|outline|placeholder|shadow|decoration|caret|accent)";

export const CATEGORIES = {
  /** The old zinc/green theme scale, addressed by shade: `bg-surface-900`, `text-brand-400`. */
  legacyPalette: new RegExp(`(?<![\\w-])${PREFIX}-(?:surface|brand)-\\d+(?:/\\d+)?(?![\\w-])`, "g"),
  /** Tailwind's built-in hues and greys: `text-purple-400`, `bg-zinc-900/50`. */
  tailwindHues: new RegExp(
    `(?<![\\w-])${PREFIX}-(?:amber|orange|purple|violet|blue|sky|pink|rose|red|emerald|green|yellow|cyan|teal|indigo|fuchsia|lime|slate|zinc|neutral|gray|stone)-\\d+(?:/\\d+)?(?![\\w-])`,
    "g",
  ),
  /** Colour literals in components. Share images and the token mirror are allowed to hold them. */
  colourLiterals: /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![0-9a-fA-F])|rgba?\([^)]*\)|oklch\([^)]*\)/g,
  /** Pixel font sizes outside the type scale: `text-[10px]`. */
  arbitraryText: /(?<![\w-])text-\[\d+(?:\.\d+)?px\](?![\w-])/g,
  /** Any other arbitrary length in a class: `p-[18px]`, `w-[340px]`, `max-w-[1400px]`. */
  arbitraryLength: /(?<![\w-])[a-z]+(?:-[a-z]+)*-\[-?\d+(?:\.\d+)?(?:px|rem)\](?![\w-])/g,
  /** Imports from any of the twelve react-icons sets; the system has one icon family. */
  reactIcons: /from\s+["']react-icons\/[a-z0-9]+["']/g,
  /** Animations that move for their own sake. */
  ambientMotion: /(?<![\w-])animate-(?:float|glow-pulse|scale-pulse|pulse-soft|spin-slow)(?![\w-])/g,
  /** Durations, delays and easings typed inline instead of taken from the motion tokens. */
  arbitraryMotion: /(?<![\w-])(?:duration|delay|ease|transition)-\[[^\]]+\]/g,
  /**
   * `outline-none` in a class string with no `focus-visible:` style beside it:
   * a keyboard user loses their place. Counted per string literal.
   */
  bareOutlineNone: /(["'`])(?:(?!\1)[^\n])*?(?<![\w-:])outline-none(?![\w-])(?:(?!\1)[^\n])*?\1/g,
  /**
   * Content widths other than the three in the system (read, app, sheet) and the structural ones.
   * A cap on a single element — a tooltip, a chart bar, a truncated name — taken from the spacing
   * scale and no wider than 20rem (`max-w-55`, `max-w-6.5`) is not a content width; anything wider
   * written on the spacing scale (`max-w-350`) still counts.
   */
  offWidths: /(?<![\w-])max-w-(?!(?:read|app|sheet|full|none|fit|min|max|prose|screen)\b)(?!(?:[1-7]?\d|80)(?:\.\d+)?(?![\w.-]))[a-z0-9[\]./-]+/g,
} as const;

export type Category = keyof typeof CATEGORIES;

/**
 * Files that may hold colour literals: the token mirror (for places CSS
 * variables cannot reach) and the html2canvas share cards, which cannot read
 * OKLCH or CSS variables at all.
 */
const LITERAL_ALLOWED = [
  /^src\/design\//,
  /^src\/app\/globals\.css$/,
  /^src\/app\/.*opengraph-image/,
  /^src\/app\/manifest/,
];

export function designFiles(): string[] {
  return sourceFiles().filter((f) => /\.(tsx?|css)$/.test(f));
}

export type Inventory = {
  totals: Record<Category, number>;
  byFile: Record<string, Partial<Record<Category, number>>>;
};

export function takeInventory(files = designFiles()): Inventory {
  const totals = Object.fromEntries(Object.keys(CATEGORIES).map((k) => [k, 0])) as Record<Category, number>;
  const byFile: Inventory["byFile"] = {};
  for (const file of files) {
    const path = rel(file);
    const text = read(file);
    for (const [name, pattern] of Object.entries(CATEGORIES) as [Category, RegExp][]) {
      if (name === "colourLiterals" && (LITERAL_ALLOWED.some((r) => r.test(path)) || !/\.tsx?$/.test(path))) continue;
      if (name !== "colourLiterals" && path.endsWith(".css") && name !== "legacyPalette") continue;
      let matches: string[] = [...(text.match(pattern) ?? [])];
      if (name === "bareOutlineNone") {
        matches = matches.filter((lit) => !/focus-visible:|focus:ring|focus:border|focus-within:/.test(lit));
      }
      const n = matches.length;
      if (!n) continue;
      totals[name] += n;
      (byFile[path] ??= {})[name] = n;
    }
  }
  return { totals, byFile };
}
