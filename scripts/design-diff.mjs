// Compare two screenshot sets from scripts/design-screens.mjs.
//
//   node scripts/design-diff.mjs <before> <after>
//
// Prints, per screen, the share of pixels that changed, and writes a diff
// image next to the "after" set for anything above the threshold. A
// mechanical change (phases 1–3 of docs/design/EXECUTION.md) should leave
// every screen at or near zero; live data (a new review, a changed trending
// list) is the usual exception and shows up as a localised block.
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const [a, b] = process.argv.slice(2).map((l) => join(".design-screens", l));
if (!a || !b) { console.error("usage: node scripts/design-diff.mjs <before> <after>"); process.exit(2); }
let worst = 0;
for (const file of readdirSync(a).filter((f) => f.endsWith(".png")).sort()) {
  if (!existsSync(join(b, file))) { console.log(`missing ${file}`); continue; }
  const A = PNG.sync.read(readFileSync(join(a, file)));
  const B = PNG.sync.read(readFileSync(join(b, file)));
  const width = Math.min(A.width, B.width), height = Math.min(A.height, B.height);
  const crop = (img) => { const o = new PNG({ width, height }); PNG.bitblt(img, o, 0, 0, width, height, 0, 0); return o; };
  const diff = new PNG({ width, height });
  const n = pixelmatch(crop(A).data, crop(B).data, diff.data, width, height, { threshold: 0.1 });
  const pct = (100 * n) / (width * height);
  const sizeNote = A.height !== B.height ? ` height ${A.height}→${B.height}` : "";
  worst = Math.max(worst, pct);
  if (pct > 0.05) writeFileSync(join(b, file.replace(".png", ".diff.png")), PNG.sync.write(diff));
  console.log(`${pct.toFixed(3).padStart(7)} %  ${file}${sizeNote}`);
}
console.log(`worst ${worst.toFixed(3)} %`);
