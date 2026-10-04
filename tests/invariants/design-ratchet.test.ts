import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CATEGORIES, takeInventory, type Category } from "./design";

/**
 * The redesign may only move forward.
 *
 * `design-baseline.json` holds the totals the last time someone lowered them.
 * A total above its baseline fails: a component added `text-violet-400`, a
 * `text-[11px]`, a react-icons import. A total below its baseline passes and
 * says so, and `UPDATE_DESIGN_BASELINE=1 npm test` writes the lower numbers
 * down so the ground just gained cannot be lost again.
 *
 * The categories, and why each is going to zero, are in
 * `docs/design/EXECUTION.md` §1 phases 0 and 2.
 */
const BASELINE = join(__dirname, "design-baseline.json");

describe("design ratchet", () => {
  const { totals, byFile } = takeInventory();

  if (process.env.UPDATE_DESIGN_BASELINE === "1") {
    writeFileSync(BASELINE, JSON.stringify(totals, null, 2) + "\n");
  }
  const baseline = JSON.parse(readFileSync(BASELINE, "utf8")) as Record<Category, number>;

  for (const name of Object.keys(CATEGORIES) as Category[]) {
    it(`${name} does not grow (baseline ${baseline[name]})`, () => {
      if (totals[name] > baseline[name]) {
        const worst = Object.entries(byFile)
          .filter(([, c]) => c[name])
          .sort((a, b) => (b[1][name] ?? 0) - (a[1][name] ?? 0))
          .slice(0, 8)
          .map(([f, c]) => `  ${f}: ${c[name]}`)
          .join("\n");
        expect.fail(
          `${name} rose from ${baseline[name]} to ${totals[name]}. Use the design tokens instead (docs/design/SYSTEM.md).\nLargest files:\n${worst}`,
        );
      }
      if (totals[name] < baseline[name]) {
        console.info(`design ratchet: ${name} fell ${baseline[name]} → ${totals[name]}; run UPDATE_DESIGN_BASELINE=1 npm test to lock it in.`);
      }
    });
  }
});
