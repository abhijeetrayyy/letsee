// Phase 1 of docs/design/EXECUTION.md: rename the old palette to named tokens.
//
//   node scripts/codemods/semantic-colours.mjs [--dry]
//
// Every `surface-*` and `brand-*` class becomes a token named for what it does
// (`bg-raised`, `border-line`, `text-ink-400`, `bg-action`), and the token is
// defined with exactly the value the old class had (src/design/tokens.css). So
// this changes no pixel. What it changes is that the colour now lives in one
// place: phase 4 edits tokens.css and every instance moves together.
//
// The mapping depends on the utility, because the same zinc shade meant
// different things in different places: `bg-surface-800` is a raised surface,
// `border-surface-800` is a hairline, `text-surface-800` is text.
//
// One rule needs context: text sitting on a solid action fill. Today that is
// white or near-black text on green; after the flip the fill is white, so the
// text must be the token that stays readable on it (`on-action`). The rename is
// done per string literal so the text and its fill are seen together.
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const dry = process.argv.includes("--dry");

const SURFACE_FILL = { 950: "page", 900: "raised", 850: "raised-2", 800: "overlay", 700: "hover", 600: "active", 500: "muted", 200: "inverse-2", 100: "inverse" };
const SURFACE_LINE = { 950: "page", 900: "raised", 800: "line", 700: "line-strong", 600: "line-input", 500: "line-bold", 400: "line-light", 300: "line-lighter" };
const BRAND = {
  bg: { 500: "action", 400: "action-hover", 600: "action-press" },
  text: { 500: "accent-strong", 400: "accent", 300: "accent-soft", 200: "accent-softer" },
  border: { 500: "accent-strong", 400: "accent" },
  from: { 500: "accent-strong" },
  to: { 400: "accent" },
  via: { 500: "accent-strong" },
  ring: { 500: "focus", 400: "accent" },
  shadow: { 500: "accent-strong" },
};
const FILL_PREFIX = new Set(["bg", "from", "to", "via", "fill", "shadow"]);
const LINE_PREFIX = new Set(["border", "divide", "outline", "ring", "stroke"]);
const INK_PREFIX = new Set(["text", "placeholder", "decoration", "caret"]);

const TOKEN = /(?<![\w-])((?:[a-z0-9-]+:|\[[^\]]+\]:)*)(bg|text|border|ring|from|to|via|fill|stroke|divide|outline|placeholder|shadow|decoration|caret)-(surface|brand)-(\d+)(\/\d+)?(?![\w-])/g;
const WHITE_TEXT = /(?<![\w-])((?:[a-z0-9-]+:)*)text-white(\/\d+)?(?![\w-])/g;

const unmapped = new Map();
function mapToken(_m, variants, prefix, scale, step, opacity = "") {
  let name;
  if (scale === "surface") {
    if (FILL_PREFIX.has(prefix)) name = SURFACE_FILL[step];
    else if (LINE_PREFIX.has(prefix)) name = SURFACE_LINE[step];
    else if (INK_PREFIX.has(prefix)) name = `ink-${step}`;
  } else {
    name = BRAND[prefix]?.[step];
  }
  if (!name) {
    const k = `${prefix}-${scale}-${step}`;
    unmapped.set(k, (unmapped.get(k) ?? 0) + 1);
    return _m;
  }
  return `${variants}${prefix}-${name}${opacity}`;
}

function rewriteLiteral(lit) {
  let out = lit.replace(TOKEN, mapToken).replace(WHITE_TEXT, (_m, v, o = "") => `${v}text-ink-0${o}`);
  // Text on a solid action fill: name it for what it sits on.
  if (/(?<![\w-:])bg-action(?![\w/-])/.test(out)) {
    out = out
      .replace(/(?<![\w-])((?:[a-z0-9-]+:)*)text-ink-0(?![\w/-])/g, "$1text-on-action-light")
      .replace(/(?<![\w-])((?:[a-z0-9-]+:)*)text-ink-(950|900)(?![\w/-])/g, "$1text-on-action");
  }
  return out;
}

// String literals and template literals; className values live in these.
const LITERAL = /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g;

function walk(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const f = join(dir, e);
    if (statSync(f).isDirectory()) walk(f, acc);
    else if (/\.(tsx|ts)$/.test(e) && !f.startsWith("src/design/")) acc.push(f);
  }
  return acc;
}

let files = 0, changes = 0;
for (const f of walk("src")) {
  const src = readFileSync(f, "utf8");
  const next = src.replace(LITERAL, (lit) => rewriteLiteral(lit));
  if (next !== src) {
    files++;
    const before = (src.match(TOKEN) ?? []).length + (src.match(WHITE_TEXT) ?? []).length;
    const after = (next.match(TOKEN) ?? []).length + (next.match(WHITE_TEXT) ?? []).length;
    changes += before - after;
    if (!dry) writeFileSync(f, next);
  }
}
console.log(`${dry ? "would change" : "changed"} ${files} files, ${changes} classes`);
if (unmapped.size) console.log("left for a person:", Object.fromEntries(unmapped));
