import SearchV2 from "@components/search/v2/SearchV2";

/**
 * Search, one implementation (docs/design/PAGES.md §4): titles, people and
 * lists, the query in the URL. `/app/search/[query]`, `/app/profile` and
 * `/app/person` redirect here (next.config.mjs).
 */
export default function SearchPage() {
  return <SearchV2 />;
}
