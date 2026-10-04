#!/usr/bin/env node
/**
 * Phase 6: put the last one-off values on the scale (docs/design/EXECUTION.md
 * phase 6, gate: every ratchet count at zero).
 *
 * Two kinds of rewrite, kept apart on purpose:
 *
 *   exact   — the same pixels, written on the scale: `aspect-[2/3]` →
 *             `aspect-2/3`, `min-h-[44px]` → `min-h-11`, `rounded-[2px]` →
 *             `rounded-xs`. No visual change.
 *   nearest — a value the system does not have, moved to the step it does:
 *             10–11 px text to the 12 px floor (SYSTEM.md §2: nothing smaller),
 *             container widths to the three content widths (read 40rem,
 *             sheet 32rem, app 76rem), wide uppercase tracking to `wider`.
 *
 * Usage: node scripts/codemods/one-scale.mjs [--dry]
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DRY = process.argv.includes("--dry");

/** px → Tailwind v4 spacing step (4 px each), only when it lands on a quarter step. */
function step(px) {
  const n = px / 4;
  return Number.isInteger(n * 4) ? String(n) : null;
}

const EXACT = [
  [/\baspect-\[2\/3\]/g, "aspect-2/3"],
  [/\baspect-\[16\/9\]/g, "aspect-video"],
  [/\brounded-\[2px\]/g, "rounded-xs"],
  [/\brounded-\[4px\]/g, "rounded"],
  [/\brounded-t-\[4px\]/g, "rounded-t"],
  // Spacing-scale properties with a px value that is a quarter step.
  [
    /\b(min-h|max-h|min-w|h|w|gap|gap-x|gap-y|size|top|left|right|bottom|inset|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr)-\[(\d+(?:\.\d+)?)px\]/g,
    (whole, prop, px) => {
      const s = step(Number(px));
      return s ? `${prop}-${s}` : whole;
    },
  ],
];

const NEAREST = [
  [/\btext-\[(9|10|11)px\]/g, "text-xs"],
  [/\btext-\[13px\]/g, "text-sm"],
  [/\btext-\[15px\]/g, "text-base"],
  [/\btext-\[19px\]/g, "text-lg"],
  [/\btext-\[2rem\]/g, "text-3xl"],
  [/\btracking-\[0\.(1[5-9]|2|3)\d*em\]/g, "tracking-wider"],
  [/\bmax-w-(sm|md|lg|xl)\b/g, "max-w-sheet"],
  [/\bmax-w-(2xl|3xl)\b/g, "max-w-read"],
  [/\bmax-w-(4xl|5xl|6xl|7xl)\b/g, "max-w-app"],
  [/\bmax-w-\[(1400|1600)px\]/g, "max-w-app"],
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(name)) out.push(p);
  }
  return out;
}

let files = 0;
let edits = 0;
for (const file of walk("src")) {
  const before = readFileSync(file, "utf8");
  let after = before;
  for (const [pattern, to] of [...EXACT, ...NEAREST]) {
    after = after.replace(pattern, (...m) => {
      const next = typeof to === "function" ? to(...m) : to;
      if (next !== m[0]) edits++;
      return next;
    });
  }
  if (after !== before) {
    files++;
    if (!DRY) writeFileSync(file, after);
  }
}
console.log(`${DRY ? "would change" : "changed"} ${edits} classes in ${files} files`);
