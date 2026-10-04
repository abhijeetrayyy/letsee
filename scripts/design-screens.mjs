// Screenshot the routes that render signed out, at a phone and a desktop width.
//
//   node scripts/design-screens.mjs <label> [baseUrl]
//
// Writes .design-screens/<label>/<name>-<width>.png (git-ignored). It waits for
// `load` plus a fixed settle time, not network idle: the dev server keeps a
// live-reload socket and Supabase keeps realtime open, so idle never comes. Run it
// against the dev server before and after a mechanical change, then compare
// with scripts/design-diff.mjs. It drives the Chrome already installed on the
// machine through playwright-core, so nothing is downloaded.
//
// Signed-in pages are not covered here: they need the fixture mode described
// in docs/design/EXECUTION.md §1 phase 0, which is not built yet.
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { SCREENS } from "./design-routes.mjs";

const label = process.argv[2] ?? "now";
const base = process.argv[3] ?? "http://localhost:3001";
const out = join(".design-screens", label);
mkdirSync(out, { recursive: true });

const WIDTHS = [
  { name: "375", viewport: { width: 375, height: 812 }, isMobile: true, deviceScaleFactor: 1 },
  { name: "1280", viewport: { width: 1280, height: 800 }, isMobile: false, deviceScaleFactor: 1 },
];

// Freeze motion and carets so two runs of the same code produce the same pixels.
const STILL = `*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}
nextjs-portal{display:none!important}`;

const browser = await chromium.launch({ channel: "chrome", headless: true });
for (const w of WIDTHS) {
  const context = await browser.newContext({ viewport: w.viewport, isMobile: w.isMobile, deviceScaleFactor: w.deviceScaleFactor, reducedMotion: "reduce" });
  const page = await context.newPage();
  for (const [name, path] of SCREENS) {
    try {
      await page.goto(base + path, { waitUntil: "load", timeout: 60_000 });
      await page.waitForTimeout(2500);
      await page.addStyleTag({ content: STILL });
      // Let lazy images below the fold load: scroll to the end and back.
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: join(out, `${name}-${w.name}.png`), fullPage: true });
      process.stdout.write(`ok   ${name}-${w.name}\n`);
    } catch (e) {
      process.stdout.write(`FAIL ${name}-${w.name}: ${String(e.message).split("\n")[0]}\n`);
    }
  }
  await context.close();
}
await browser.close();
