import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Node environment, not jsdom: nothing here renders a component.
 *
 * That is deliberate rather than a first step. The parts of this codebase that
 * have actually broken are pure logic (a CSV scanner, a cursor, a batch
 * builder) and repo-wide rules (which routes may be cached, which columns may
 * be selected). Neither needs a DOM, and a component harness would be a lot of
 * scaffolding for the layer that has been reliable.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // The invariant suite reads every route file; give it room.
    testTimeout: 20_000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@components": fileURLToPath(new URL("./src/components", import.meta.url)),
    },
  },
});
