import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TOKENS } from "../../src/design/tokens";

/**
 * Every colour pair the design allows is readable, and stays readable.
 *
 * Reads `src/design/tokens.css`, resolves aliases, and checks each declared
 * pair against WCAG 2.2: 4.5 : 1 for text, 3 : 1 for edges and focus rings.
 * A palette change that fails a pair cannot ship, which matters because the
 * whole look now changes from one file.
 *
 * It also checks that `tokens.ts` (the hex mirror for JS) agrees with the CSS.
 */
const css = readFileSync(join(process.cwd(), "src", "design", "tokens.css"), "utf8");
// Two palettes: the light defaults in `@theme`, and the dark ones under
// `[data-theme="dark"]`, which redefine the same names.
const [lightCss, darkCss = ""] = css.split('\n[data-theme="dark"] {');
function palette(source: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const x of source.matchAll(/--color-([a-z0-9-]+):\s*([^;]+);/g)) m.set(x[1], x[2].trim());
  return m;
}
const LIGHT_PALETTE = palette(lightCss);
const DARK_PALETTE = new Map([...LIGHT_PALETTE, ...palette(darkCss)]);
let raw = LIGHT_PALETTE;

function resolve(name: string, depth = 0): string {
  const v = raw.get(name);
  if (!v) throw new Error(`no token --color-${name}`);
  const alias = /^var\(--color-([a-z0-9-]+)\)$/.exec(v);
  if (alias && depth < 8) return resolve(alias[1], depth + 1);
  if (!/^#[0-9a-f]{6}$/i.test(v)) throw new Error(`--color-${name} is not a hex value: ${v}`);
  return v.toLowerCase();
}

function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** [foreground, background, minimum] */
const TEXT = 4.5, EDGE = 3;
const PAIRS: [string, string, number][] = [
  ...["page", "raised", "overlay"].flatMap((bg) =>
    ["ink-0", "ink-100", "ink-200", "ink-300", "ink-400", "accent", "accent-strong"].map((fg) => [fg, bg, TEXT] as [string, string, number]),
  ),
  ["ink-500", "page", TEXT],
  ["ink-500", "raised", TEXT],
  // The quietest text step: labels, dates, credits. axe found it at 3.9 : 1
  // on paper before it was a pair here.
  ["ink-600", "page", TEXT],
  ["ink-600", "raised", TEXT],
  ["ink-600", "overlay", TEXT],
  // Selected chips and green notices: this text sits on a 10–20 % action
  // tint, so it needs room to spare on plain paper (it was 3.8 : 1 on the tint).
  ["accent-soft", "page", 5.5],
  ["accent-soft", "raised", 5.5],
  ["accent-softer", "page", TEXT],
  // Errors sit on their own 10 % tint (sign-in, sign-up), so the same margin.
  ["danger", "page", 5.5],
  ["on-action", "action", TEXT],
  ["on-action-light", "action", TEXT],
  ["line-input", "page", EDGE],
  ["focus", "page", EDGE],
  ["focus", "raised", EDGE],
];

/**
 * Pairs that fail on purpose, with the reason. Empty since phase 4: phase 1
 * kept the old colours, whose secondary grey (4.12 : 1), white-on-green
 * (2.28 : 1) and input border failed, and the graphite system fixed all three.
 * The test checks that every entry here still fails, so a fixed pair cannot
 * linger.
 */
const KNOWN_FAILING = new Set<string>([]);

describe.each([
  ["light", LIGHT_PALETTE],
  ["dark", DARK_PALETTE],
] as const)("token contrast, %s", (_name, pal) => {
  for (const [fg, bg, min] of PAIRS) {
    const label = `${fg} on ${bg}`;
    it(`${label} ≥ ${min} : 1`, () => {
      raw = pal;
      const ratio = contrast(resolve(fg), resolve(bg));
      if (KNOWN_FAILING.has(label)) {
        expect(ratio, `${label} now passes (${ratio.toFixed(2)}); remove it from KNOWN_FAILING`).toBeLessThan(min);
      } else {
        expect(ratio, `${label} is ${ratio.toFixed(2)} : 1`).toBeGreaterThanOrEqual(min);
      }
    });
  }

  it("tokens.ts mirrors tokens.css", () => {
    raw = LIGHT_PALETTE;
    const pairs: [keyof typeof TOKENS, string][] = [
      ["page", "page"], ["raised", "raised"], ["overlay", "overlay"], ["hover", "hover"], ["line", "line"],
      ["lineStrong", "line-strong"], ["ink0", "ink-0"], ["ink200", "ink-200"], ["ink300", "ink-300"],
      ["ink400", "ink-400"], ["ink500", "ink-500"], ["action", "action"], ["onAction", "on-action"],
      ["accent", "accent"], ["accentStrong", "accent-strong"], ["focus", "focus"],
    ];
    for (const [ts, cssName] of pairs) expect(TOKENS[ts].toLowerCase(), `TOKENS.${ts} vs --color-${cssName}`).toBe(resolve(cssName));
  });
});
