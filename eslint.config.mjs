import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

/**
 * ESLint 9 flat config.
 *
 * Linting had been dead for a while, in two independent ways that both failed
 * quietly. `next lint` was removed in Next 16, so `npm run lint` passed the
 * word "lint" as a directory and reported "no such directory". And ESLint 9
 * reads flat config by default, so the repo's `.eslintrc.json` was not being
 * loaded even when eslint was invoked directly.
 *
 * `eslint-config-next` 16 ships a flat config of its own, which is imported
 * directly here. Wrapping the legacy config through FlatCompat instead throws
 * on a circular structure in the react plugin — the compatibility shim is the
 * wrong tool once the package has a native export.
 *
 * The ruleset is unchanged: this restores the linting the project already
 * intended rather than introducing a different opinion.
 */
export default [
  {
    ignores: ["node_modules/**", ".next/**", ".next-build/**", "public/**", "next-env.d.ts"],
  },
  ...(Array.isArray(nextCoreWebVitals) ? nextCoreWebVitals : [nextCoreWebVitals]),
];
