// The automated half of the definition of done (docs/design/EXECUTION.md §5),
// for the pages design-routes.mjs lists, signed out.
//
//   node scripts/design-audit.mjs [baseUrl] [name …]   (baseUrl only when it starts with http)
//
// For each page:
//   - axe, WCAG 2.1 A and AA, at 375 and 1280 (each width hides different
//     things), plus the landmark rules that catch a <main> inside a <main>;
//   - its height on a phone, in screens of 812 px, with folds closed;
//   - sideways scroll at 320 and 375, naming what sticks out;
//   - the first keyboard stops at 1280, and whether each shows a focus ring;
//   - a lazy image above the fold (the largest one there should not be lazy).
// Writes .design-screens/audit.json (git-ignored) and prints a summary. Drives
// the Chrome already installed, like design-screens.mjs; axe comes from
// node_modules, so nothing is downloaded.
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { SCREENS } from "./design-routes.mjs";

const require = createRequire(import.meta.url);
const AXE = require.resolve("axe-core/axe.min.js");
const args = process.argv.slice(2);
const base = args[0]?.startsWith("http") ? args.shift() : "http://localhost:3001";
const only = args;
const routes = only.length ? SCREENS.filter(([n]) => only.includes(n)) : SCREENS;

const STILL = `*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}
nextjs-portal{display:none!important}`;
const RULES = { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } };
const LANDMARKS = { runOnly: { type: "rule", values: ["landmark-no-duplicate-main", "landmark-main-is-top-level", "page-has-heading-one", "heading-order"] } };

async function settle(page, path) {
  await page.goto(base + path, { waitUntil: "load", timeout: 60_000 });
  await page.waitForTimeout(2500);
  await page.addStyleTag({ content: STILL });
}

async function axe(page) {
  await page.addScriptTag({ path: AXE });
  return page.evaluate(async ([rules, landmarks]) => {
    const pick = (r) => r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 4).map((n) => n.target.join(" ") + (n.failureSummary ? ` — ${n.failureSummary.split("\n").slice(1, 2).join("").trim()}` : "")), count: v.nodes.length }));
    const a = await window.axe.run(document, rules);
    const b = await window.axe.run(document, landmarks);
    return [...pick(a), ...pick(b).map((v) => ({ ...v, advice: true }))];
  }, [RULES, LANDMARKS]);
}

// What makes the page wider than the screen: leaf-most elements whose right
// edge passes the viewport, skipping anything inside a sideways scroller.
async function overflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const extra = doc.scrollWidth - doc.clientWidth;
    if (extra <= 0) return { extra: 0, culprits: [] };
    const scrolls = (el) => { for (let p = el.parentElement; p; p = p.parentElement) { const s = getComputedStyle(p); if (/(auto|scroll|hidden|clip)/.test(s.overflowX) && p !== doc && p !== document.body) return true; } return false; };
    const out = [];
    for (const el of document.body.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.right <= doc.clientWidth + 1 || scrolls(el)) continue;
      if ([...el.children].some((c) => c.getBoundingClientRect().right > doc.clientWidth + 1)) continue;
      out.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 4).join(".")} → ${Math.round(r.right)}px`);
      if (out.length >= 5) break;
    }
    return { extra, culprits: out };
  });
}

// A focus ring is a change: the element's outline or shadow while focused,
// compared with the same element unfocused (a permanent ring-1 is not one).
async function keyboard(page) {
  const stops = [];
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("Tab");
    stops.push(await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const look = () => {
        const s = getComputedStyle(el);
        return `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor} | ${s.boxShadow}`;
      };
      const focused = look();
      el.blur();
      const resting = look();
      el.focus();
      const name = (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40);
      return `${el.tagName.toLowerCase()} "${name}"${focused !== resting ? "" : " (no ring)"}`;
    }));
  }
  return stops;
}

// The largest image in the first screen, if it is lazy. Decorative layers
// (aria-hidden, like a person's blurred poster wall) don't count, nor does
// anything in a closed fold: Chrome still reports a size for it, but it is
// neither visible nor fetched.
async function lazyAboveFold(page) {
  return page.evaluate(() => {
    const area = (i) => { const r = i.getBoundingClientRect(); return r.top < window.innerHeight && r.bottom > 0 ? r.width * r.height : 0; };
    const seen = [...document.images].filter((i) => !i.closest("[aria-hidden='true']") && i.checkVisibility() && area(i) > 0);
    const largest = seen.sort((a, b) => area(b) - area(a))[0];
    return largest && largest.loading === "lazy" ? [largest.currentSrc.split("/").pop()?.slice(0, 40)] : [];
  });
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
const phone = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
const narrow = await browser.newContext({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
const desk = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
const report = {};
for (const [name, path] of routes) {
  const r = { path };
  const pages = [];
  try {
    const p = await phone.newPage();
    pages.push(p);
    await settle(p, path);
    r.finalPath = new URL(p.url()).pathname;
    r.screens = +(await p.evaluate(() => document.documentElement.scrollHeight / 812)).toFixed(1);
    r.overflow375 = await overflow(p);
    r.lazyAboveFold = await lazyAboveFold(p);
    r.axe375 = await axe(p);

    const n = await narrow.newPage();
    pages.push(n);
    await settle(n, path);
    r.overflow320 = await overflow(n);

    const d = await desk.newPage();
    pages.push(d);
    await settle(d, path);
    r.axe1280 = await axe(d);
    await d.goto(base + path, { waitUntil: "load" });
    await d.waitForTimeout(1500);
    r.keyboard = await keyboard(d);
  } catch (e) {
    r.error = String(e.message).split("\n")[0];
  } finally {
    await Promise.all(pages.map((pg) => pg.close().catch(() => {})));
  }
  report[name] = r;

  const seen = new Map();
  for (const v of [...(r.axe375 ?? []), ...(r.axe1280 ?? [])]) if (!seen.has(v.id)) seen.set(v.id, v);
  const flags = [
    r.error && `ERROR ${r.error}`,
    r.finalPath && r.finalPath !== path.split("?")[0] && `redirected → ${r.finalPath}`,
    r.overflow320?.extra > 0 && `320 overflow +${r.overflow320.extra}px`,
    r.overflow375?.extra > 0 && `375 overflow +${r.overflow375.extra}px`,
    r.lazyAboveFold?.length && `lazy above fold ×${r.lazyAboveFold.length}`,
    ...[...seen.values()].map((v) => `${v.advice ? "advice" : "axe"}:${v.id}(${v.count})`),
  ].filter(Boolean);
  process.stdout.write(`${name.padEnd(16)} ${String(r.screens ?? "-").padStart(5)} screens  ${flags.join("  ") || "clean"}\n`);
}
await browser.close();
mkdirSync(".design-screens", { recursive: true });
writeFileSync(".design-screens/audit.json", JSON.stringify(report, null, 2));
