// Phase 4 of docs/design/EXECUTION.md: hue means a film, a face, or danger.
//
//   node scripts/codemods/neutral-hues.mjs [--dry]
//
// Rewrites the one-off Tailwind hues (453 uses of 14 colours on 3 October 2026)
// to tokens, by what each colour was doing:
//
//   red, rose          → danger (errors, destructive actions)
//   amber, yellow,     → neutral ink: these were mostly star ratings, which are
//   orange               white in the new system, and warnings, which carry an
//                        icon and words instead of a colour
//   everything else    → neutral ink: blue, indigo, purple, violet, sky, cyan,
//                        teal, pink, fuchsia, emerald, green, lime were section
//                        accents and badges — hue as decoration
//   gray, zinc, …      → the ink/surface tokens of the same shade
//
// Solid fills keep their weight as graphite surfaces rather than turning white,
// so white text on them stays readable. Opacity modifiers are kept.
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const dry = process.argv.includes("--dry");
const DANGER = new Set(["red", "rose"]);
const GREYS = new Set(["gray", "zinc", "neutral", "slate", "stone"]);
const GREY_FILL = { 950: "page", 900: "raised", 800: "overlay", 700: "hover", 600: "active", 500: "muted" };
const GREY_LINE = { 950: "page", 900: "raised", 800: "line", 700: "line-strong", 600: "line-input", 500: "line-bold", 400: "line-light" };

const HUE = /(?<![\w-])((?:[a-z0-9-]+:)*)(bg|text|border|ring|from|to|via|fill|stroke|divide|outline|shadow|decoration|placeholder)-(amber|orange|purple|violet|blue|sky|pink|rose|red|emerald|green|yellow|cyan|teal|indigo|fuchsia|lime|slate|zinc|neutral|gray|stone)-(\d+)(\/\d+)?(?![\w-])/g;

function inkFor(step) {
  const n = Number(step);
  if (n <= 200) return "ink-100";
  if (n <= 300) return "ink-200";
  if (n <= 400) return "ink-300";
  if (n <= 500) return "ink-400";
  return "ink-500";
}

function map(_m, v, prefix, hue, step, op = "") {
  if (GREYS.has(hue)) {
    if (["text", "placeholder", "decoration"].includes(prefix)) return `${v}${prefix}-ink-${step}${op}`;
    const t = (["border", "divide", "ring", "outline", "stroke"].includes(prefix) ? GREY_LINE : GREY_FILL)[step];
    return t ? `${v}${prefix}-${t}${op}` : _m;
  }
  if (DANGER.has(hue)) {
    if (prefix === "bg" && !op) return `${v}bg-danger-fill`;
    if (["text", "placeholder", "decoration"].includes(prefix)) return `${v}${prefix}-danger${op}`;
    return `${v}${prefix}-danger${op}`;
  }
  // Decorative hues and ratings → neutral.
  if (["text", "placeholder", "decoration"].includes(prefix)) return `${v}${prefix}-${inkFor(step)}${op}`;
  if (prefix === "fill" || prefix === "stroke") return `${v}${prefix}-ink-0${op}`;
  if (prefix === "bg") return op ? `${v}bg-ink-0${op}` : `${v}bg-${Number(step) >= 600 ? "active" : "hover"}`;
  if (["border", "divide", "outline"].includes(prefix)) return op ? `${v}${prefix}-ink-0${op}` : `${v}${prefix}-line-input`;
  if (prefix === "ring") return `${v}ring-focus${op}`;
  if (prefix === "shadow") return `${v}shadow-page${op}`;
  return `${v}${prefix}-ink-0${op || "/10"}`; // from, to, via: a faint neutral wash
}

function walk(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const f = join(dir, e);
    if (statSync(f).isDirectory()) walk(f, acc);
    else if (/\.tsx?$/.test(e) && !f.startsWith("src/design/")) acc.push(f);
  }
  return acc;
}

let files = 0, n = 0;
for (const f of walk("src")) {
  const src = readFileSync(f, "utf8");
  const next = src.replace(HUE, (...a) => { n++; return map(...a); });
  if (next !== src) { files++; if (!dry) writeFileSync(f, next); }
}
console.log(`${dry ? "would change" : "changed"} ${files} files, ${n} classes`);
