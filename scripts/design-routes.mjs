// The pages the design scripts visit signed out, by name. Shared by
// design-screens.mjs (screenshots) and design-audit.mjs (the definition of
// done checks), so the two always look at the same set.
//
// Signed-in pages need the fixture mode in docs/design/EXECUTION.md §1, which
// is not built; signed out, the /app pages show their signed-out state.
export const SCREENS = [
  ["front-door", "/"],
  ["login", "/login"],
  ["signup", "/signup"],
  ["forgot-password", "/forgot-password"],
  ["invite", "/invite?from=ray"],
  ["home-signed-out", "/app"],
  ["film", "/app/movie/27205"],
  ["film-cast", "/app/movie/27205/cast"],
  ["series", "/app/tv/1396"],
  ["series-cast", "/app/tv/1396/cast"],
  ["season", "/app/tv/1396/season/1"],
  ["episode", "/app/tv/1396/season/1/episode/1"],
  ["person", "/app/person/525"],
  ["search", "/app/search"],
  ["search-query", "/app/search?q=dune"],
  ["search-people", "/app/search?scope=people"],
  ["browse", "/app/search?browse=1&genre=18"],
  ["profile", "/app/profile/ray"],
  ["month", "/app/profile/ray/month/2026-08"],
  ["year", "/app/profile/ray/year/2026"],
  ["review", "/app/review/49"],
  ["lists", "/app/lists"],
  ["up-next", "/app/up-next"],
  ["tonight", "/app/tonight"],
  ["settings", "/app/settings"],
  ["tv-time", "/tv-time"],
];
