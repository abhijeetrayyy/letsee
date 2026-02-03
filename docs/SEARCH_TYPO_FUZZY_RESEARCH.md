# Search: Typo Tolerance, Fuzzy & Phonetic (Free Only)

How users actually search: typos, misspellings, mispronunciations, and how to handle them **without paid services**.

---

## 1. How humans enter search

- **Typos**: "inception" → "inceotion", "avengers" → "avangers"
- **Misspellings**: "recommend" → "reccomend"
- **Phonetic / “sounds like”**: "Schwarzenegger" → "shwazeneger", "Nolan" → "Knowlan"
- **Partial words**: "inc" expecting "Inception"
- **Wrong language / transliteration**: "Batman" vs "Бэтмен"

**TMDB API**: Does **not** document fuzzy or typo-tolerant search. It uses text-based search; exact or near-exact query often works best. No paid TMDB tier for “fuzzy” — we only have the public API.

**Constraint**: No paid services (no Algolia, no paid TMDB add-ons, no paid spell-check APIs).

---

## 2. Free approaches (no backend cost)

### A. Client-side fuzzy over API results (recommended first step)

**Idea**: Keep calling TMDB with the user’s query as-is. After you get results, **re-rank or filter** on the client with a fuzzy library so typos still surface good matches.

- **Fuse.js** (MIT, zero deps)
  - Fuzzy search over arrays of objects (e.g. movie/tv/person titles).
  - Options: `threshold` (0 = exact, 1 = match anything), `includeScore`, `keys` (which fields to search).
  - Use on the list returned by `/api/search` to re-order by similarity to query, or to show “Did you mean?” style suggestions.
- **Flow**: `User types "inceotion"` → TMDB may return little → you could try a **corrected** query (see B) or show “No results” + suggestions. If TMDB returns some results, run Fuse.js over them with query `"inceotion"` to rank by similarity.

**Pros**: No new backend, no new API, works with current TMDB.  
**Cons**: If TMDB returns nothing, fuzzy re-ranking doesn’t help; you need a fallback (e.g. query correction).

---

### B. Query correction / “Did you mean?” (client-side, free)

**Idea**: Before or after calling TMDB, suggest a corrected query using a small, free dictionary or the results you already have.

1. **Levenshtein distance** (edit distance)
   - Count insert/delete/substitute to turn query into a known word.
   - Use on: **recent searches** or a **small list of popular titles** (e.g. top 100 movies) stored in the app.
   - Libraries: `fastest-levenshtein`, `levenshtein` (npm), or implement a short version yourself.
2. **Jaro–Winkler**
   - Good for typos and short words; gives a similarity score.
   - Library: `jaro-winkler` (npm, MIT).
3. **Soundex / phonetic**
   - Encode words by sound; “Nolan” and “Knowlan” get the same or similar code.
   - Library: `soundex-code` (npm).
   - Use to match query against a small set of titles/names; suggest closest match as “Did you mean X?”.

**Flow**:  
- User types `"inceotion"`.  
- You have a small set of strings (e.g. recent searches + maybe a few dozen popular titles).  
- Compute similarity (Levenshtein or Jaro–Winkler) between `"inceotion"` and each string.  
- If best match is above a threshold (e.g. “Inception”), show: “Did you mean **Inception**?” and run search again with “Inception” when they tap it.

**Pros**: No paid API; works entirely in the browser.  
**Cons**: Need a small “dictionary” (recent searches + optional static list). Won’t fix every possible typo.

---

### C. Misspelling-tolerant autocomplete (client-side)

**Idea**: As the user types, show suggestions that are tolerant to typos.

- **MissPlete** (GitHub: miss-plete, ES6, ~220 lines)
  - Uses Jaro–Winkler; good for autocomplete over a fixed list.
  - You’d use a **static or cached list** (e.g. popular movie titles) and run MissPlete over it; when user selects one, send that corrected title to your search (e.g. TMDB).
- **Fuse.js** again: same idea — autocomplete list = array of strings, Fuse.js fuzzy-matches as user types.

**Pros**: Free, no backend change.  
**Cons**: Autocomplete list must be maintained (e.g. top N titles cached or built from TMDB once).

---

### D. Backend / server-side (still free)

If you later add your own backend (e.g. Node):

- **Typesense** (open source)
  - Typo-tolerant, fuzzy search engine; self-hosted or Typesense Cloud free tier.
  - You’d index movie/TV/person data and query Typesense instead of (or in front of) TMDB search.
- **Meilisearch** (open source)
  - Similar: typo tolerance, faceted search; self-hosted.
- **Elasticsearch/OpenSearch** (open source)
  - “fuzzy” query; more setup, but no per-query fee.

**Pros**: Strong typo tolerance and scaling.  
**Cons**: You need to host and maintain the service and keep data in sync with TMDB (or your DB). Not “zero cost” in terms of infra.

---

## 3. Recommended order (no paid services)

1. **Already done**: Same search behavior on mobile and desktop (live fetch on word change on `/app/search`).
2. **Next (low effort)**  
   - **Fuse.js** on the **current TMDB results**: re-rank by fuzzy score so slightly wrong spellings still bring the right title to the top.  
   - Optional: “Did you mean?” using **recent searches** + **Jaro–Winkler** or Levenshtein: if the user’s query is very close to a recent search or a known title, show “Did you mean X?” and search again on click.
3. **Later (if you want better UX)**  
   - Small **client-side list** of popular titles (e.g. top 200 movies/TV); use Fuse.js or MissPlete for typo-tolerant autocomplete; on select, search TMDB with the corrected title.  
   - Optionally add **phonetic (Soundex)** for “sounds like” names (e.g. actors, directors).

---

## 4. Summary

| Goal                         | Free approach                          | Where it runs |
|-----------------------------|----------------------------------------|---------------|
| Same behavior mobile/desktop| Live fetch on input (done)             | Search page   |
| Fuzzy re-rank results       | Fuse.js over TMDB response             | Client        |
| “Did you mean?”             | Levenshtein / Jaro–Winkler on recent + small list | Client |
| Typo-tolerant autocomplete  | Fuse.js or MissPlete over cached list  | Client        |
| “Sounds like” names         | Soundex on names + small set           | Client        |
| No paid services            | All of the above use OSS libraries     | —             |

TMDB does not provide built-in typo tolerance; all of the above are additions on top of your current search flow, with **no extra paid APIs**.
