# TMDB + adjacent data sources: inventory and feature ideas for a movie/TV journaling + social app

Date: 2026-09-10. Status: COMPLETE.

## How this was researched (read this first)

- `developer.themoviedb.org` and `www.themoviedb.org` refuse the fetcher used here and also fail to load in the user's Chrome (error page), and archive.org is blocked. So the TMDB reference below was reconstructed from three sources and cross-checked:
  1. **sirjosh.mintlify.app** - a third-party mirror generated from TMDB's own OpenAPI file (one `.md` page per endpoint). Where the mirror is wrong or garbled (it is, in a few places - noted inline), I corrected it from first-hand knowledge of the official reference and flagged the correction.
  2. **github.com/api-evangelist/tmdb** - an independent profile of the v3 OpenAPI (148 paths / 152 operations) with rate-limit and plan YAMLs that cite the official docs.
  3. **TMDB Talk forum threads** surfaced through search snippets (thread IDs cited so you can open them).
- Adjacent sources (OMDb, Trakt, Simkl, TVmaze, TheTVDB, Watchmode, Streaming Availability, Kinocheck, YouTube, Wikidata, Wikipedia, IMDb datasets, MovieLens, JustWatch, Common Sense) were read from their live docs. Trakt's and Simkl's full API blueprints were downloaded and grepped.
- Confidence markers: **[verified]** = read from a live doc today; **[snippet]** = from a search-result excerpt of an official page/thread; **[recall]** = from the official reference as I know it, not re-read today; **[unverified]** = could not confirm.
- Useful 2026 fact: TMDB now serves its docs as Markdown - `https://developer.themoviedb.org/llms.txt` is an index, and appending `.md` to any doc URL returns Markdown. [snippet] Use that when you have a network path that works.

---

## 0. Headline facts

| Fact | Value | Source |
|---|---|---|
| Rate limit | Legacy 40 req / 10 s was disabled 2019-12-16. Today: no published quota, a soft anti-scrape ceiling "somewhere in the 40-50 requests per second range" per key; 429 with TMDB `status_code: 25`; "could change at any time". No daily cap. | developer.themoviedb.org/docs/rate-limiting [snippet]; api-evangelist rate-limits YAML [verified] |
| Auth | v3: `?api_key=` or `Authorization: Bearer <API Read Access Token>`. v4: Bearer only; user features need a v4 user access token (or v3 `session_id`). | docs/getting-started [snippet] |
| append_to_response | Up to **20** sub-resources in one call; works on movie, tv, season, episode, person (and collection). | api-evangelist README [verified]; [recall] |
| Commercial use | Free for non-commercial with attribution. Staff on Talk: "Ads or pay for software is fine, as long as you attribute TMDB". Anything bigger (SaaS charging users, AI/ML training, sublicensing) = written agreement via support@themoviedb.org / themoviedb.org/api-for-business, custom pricing. | talk/592c8779, FAQ [snippet]; api-evangelist plans YAML [verified] |
| Required attribution | Notice: **"This product uses the TMDB API but is not endorsed or certified by TMDB."** in About/Credits. Logo: use an approved image, no recolor/stretch/flip/rotate, less prominent than your own mark, no implied endorsement. | api-terms-of-use [snippet] |
| Cache cap | "Cache TTL cap of 6 months applies to all uses." | api-evangelist plans YAML citing the ToU [verified]; treat as their reading of the ToU |
| Watch providers | 100% JustWatch data. JustWatch pushes once per 24 h; TMDB ingests a few hours later (~8 h lag). **Not** tracked by `/changes`. **You must attribute JustWatch** when showing it. No deep links, no prices, no expiry dates. | talk/616024f4, talk/673f68df, talk/63de2458 [snippet]; watch-providers doc [recall] |
| Daily ID exports | `https://files.tmdb.org/p/exports/<type>_ids_MM_DD_YYYY.json.gz` - confirmed live for 2026-09-09 (movie file > 10 MB). | [verified by fetch] |
| API future | Talk thread "TMDB API future" (2026-03-14): staff says the Spotify-style crackdown isn't coming; "we only have metadata". | talk/69b5b90166f46a7d63ce5dcf [snippet] |
| YouTube quota (matters for trailers) | Since **2026-06-01** `search.list` has its own bucket of **100 calls/day**; everything else shares 10,000 units/day. `videos.list` = 1 unit. | developers.google.com/youtube/v3/determine_quota_cost [verified] |

---

## 1. TMDB endpoint inventory

Base: `https://api.themoviedb.org/3/...` (v4: `/4/...`). All list endpoints paginate 20/page, `page` 1..500. `language` = `xx-YY` locale; falls back per field.

### 1.1 Movies

`GET /movie/{movie_id}` [verified via mirror] - fields:

| Field | Notes |
|---|---|
| `adult` | pornography flag (see 2.4) |
| `backdrop_path`, `poster_path` | join with image base (1.12) |
| `belongs_to_collection` | `{id, name, poster_path, backdrop_path}` or null - your franchise hook |
| `budget`, `revenue` | integers, 0 when unknown (very often 0) |
| `genres[] {id,name}` | |
| `homepage`, `imdb_id`, `origin_country[]`, `original_language`, `original_title`, `overview`, `popularity` | `popularity` is a daily-recomputed score (views, votes, release proximity), not a rank |
| `production_companies[] {id, logo_path, name, origin_country}`, `production_countries[] {iso_3166_1,name}`, `spoken_languages[] {english_name, iso_639_1, name}` | |
| `release_date` | primary release (earliest); use `release_dates` for per-country |
| `runtime` | minutes; null/0 on many obscure titles |
| `status` | `Rumored`, `Planned`, `In Production`, `Post Production`, `Released`, `Canceled` [recall] |
| `tagline`, `title`, `video` (has a video-only release), `vote_average` (0-10), `vote_count` | |

Sub-endpoints (`/movie/{id}/...`) [verified list]:

| Sub-resource | What you get | Notes |
|---|---|---|
| `credits` | `cast[] {id, name, character, order, profile_path, known_for_department, popularity, gender, cast_id, credit_id}` `crew[] {job, department, ...}` | `order` = billing |
| `images` | `backdrops[]`, `logos[]`, `posters[]` each `{aspect_ratio, height, width, iso_639_1, file_path, vote_average, vote_count}` | `include_image_language=en,null` (comma list; `null` = textless) [verified] |
| `videos` | `{iso_639_1, iso_3166_1, name, key, site, size, type, official, published_at, id}`; `site` = YouTube/Vimeo; `type` in Trailer, Teaser, Clip, Featurette, Behind the Scenes, Bloopers, Opening Credits | `include_video_language=en,null` [recall; mirror omits it] |
| `keywords` | `keywords[] {id, name}` | community-tagged (see 2.1) |
| `release_dates` | `results[] {iso_3166_1, release_dates[] {certification, descriptors[], iso_639_1, note, release_date, type}}` | `type`: 1 Premiere, 2 Theatrical (limited), 3 Theatrical, 4 Digital, 5 Physical, 6 TV [recall - the mirror mislabels 4/5]. `certification` per country ("R", "U/A 16+", "15"); `descriptors` mostly empty; `note` = festival/city |
| `alternative_titles` | `titles[] {iso_3166_1, title, type}` (`type` e.g. "working title") | `?country=IN` |
| `translations` | `translations[] {iso_3166_1, iso_639_1, name, english_name, data{homepage, overview, runtime, tagline, title}}` | 50+ locales on big films |
| `external_ids` | `imdb_id, wikidata_id, facebook_id, instagram_id, twitter_id` | [verified] (no TikTok/YouTube on movies) |
| `watch/providers` | see 1.7 | |
| `recommendations` | 40-ish titles; TMDB's own model (user behaviour, ratings/lists) [recall] | not documented how |
| `similar` | keyword+genre overlap [recall] | worse than recommendations |
| `reviews` | `{author, author_details{name, username, avatar_path, rating}, content, created_at, id, updated_at, url}` | **read-only** - no API to post reviews [verified] |
| `lists` | public TMDB lists containing the movie | |
| `changes` | see 1.9 | |
| `account_states` | `favorite`, `rated{value}`, `watchlist` for the session | |
| `rating` (POST/DELETE) | body `{value: 0.5-10.0 step 0.5}` with `session_id` or `guest_session_id` | |
| `/movie/latest` | newest id | |

Also: `GET /collection/{id}` -> `{id, name, overview, poster_path, backdrop_path, parts[] (movie list objects with release_date)}` plus `/collection/{id}/images`, `/translations` [verified]; `GET /company/{id}` (+`alternative_names`, `images`); `GET /network/{id}` (+`alternative_names`, `images`); `GET /review/{id}`; `GET /credit/{credit_id}`; `GET /keyword/{id}`; `GET /keyword/{id}/movies` (**deprecated** - use discover `with_keywords`) [verified].

### 1.2 TV series / seasons / episodes / episode groups

`GET /tv/{series_id}` [verified] - fields: `adult`, `backdrop_path`, `created_by[] {id, credit_id, name, original_name, gender, profile_path}`, `episode_run_time[]` (often **empty** for streaming shows - use per-episode `runtime`), `first_air_date`, `genres[]`, `homepage`, `id`, `in_production` (bool), `languages[]`, `last_air_date`, `last_episode_to_air {air_date, episode_number, episode_type, id, name, overview, production_code, runtime, season_number, show_id, still_path, vote_average, vote_count}`, `next_episode_to_air` (same shape or **null**), `name`, `networks[] {id, logo_path, name, origin_country}`, `number_of_episodes`, `number_of_seasons`, `origin_country[]`, `original_language`, `original_name`, `overview`, `popularity`, `poster_path`, `production_companies[]`, `production_countries[]`, `seasons[] {air_date, episode_count, id, name, overview, poster_path, season_number, vote_average}`, `spoken_languages[]`, `status`, `tagline`, `type`, `vote_average`, `vote_count`.

- `status` values: `Returning Series`, `Planned`, `In Production`, `Ended`, `Canceled`, `Pilot` [recall]. `type` values: `Documentary`, `News`, `Miniseries`, `Reality`, `Scripted`, `Talk Show`, `Video` [recall].
- `episode_type`: `standard`, `finale`, `mid_season` [recall; mirror shows standard/finale].

Series sub-endpoints [verified list]: `account_states`, `aggregate_credits`, `alternative_titles`, `changes`, `content_ratings`, `credits`, `episode_groups`, `external_ids`, `images`, `keywords`, `lists`, `recommendations`, `reviews`, `screened_theatrically`, `similar`, `translations`, `videos`, `watch/providers`, `rating` (POST/DELETE), `/tv/latest`.

| Sub-resource | Shape / notes |
|---|---|
| `aggregate_credits` | `cast[] {..., roles[] {credit_id, character, episode_count}, total_episode_count, order}`; `crew[] {..., jobs[] {credit_id, job, episode_count}, department, total_episode_count}`. This is the one to use for "who's in this show" - `credits` only returns the current-season regulars. Also exists at season level. [verified] |
| `content_ratings` | `results[] {iso_3166_1, rating, descriptors[]}` - e.g. US `TV-MA`, GB `15`, IN `A`/`U/A 16+`. `descriptors` almost always empty. [verified] |
| `episode_groups` | `results[] {description, episode_count, group_count, id, name, network, type}`; `type`: 1 Original air date, 2 Absolute, 3 DVD, 4 Digital, 5 Story arc, 6 Production, 7 TV [recall]. Then `GET /tv/episode_group/{id}` -> `groups[] {id, name, order, locked, episodes[] {order, episode_number, season_number, show_id, air_date, name, overview, runtime, still_path, episode_type, vote_average...}}` [verified] |
| `screened_theatrically` | `results[] {id, episode_number, season_number}` [recall; mirror schema empty] |
| `external_ids` | `imdb_id, freebase_mid, freebase_id, tvdb_id, tvrage_id, wikidata_id, facebook_id, instagram_id, twitter_id` [recall] |
| `keywords` | `results[] {id, name}` (note the key is `results` on TV, `keywords` on movies) [recall] |

`GET /tv/{id}/season/{n}` [verified] -> `{_id, air_date, id, name, overview, poster_path, season_number, vote_average, episodes[] {air_date, episode_number, episode_type, id, name, overview, production_code, runtime, season_number, show_id, still_path, vote_average, vote_count, crew[], guest_stars[]}}`. Season sub-endpoints: `account_states`, `aggregate_credits`, `changes`, `credits`, `external_ids`, `images`, `translations`, `videos`, `watch/providers`. `append_to_response` works here too (e.g. `season/1?append_to_response=credits,images`).

`GET /tv/{id}/season/{n}/episode/{e}` -> same episode object with `crew`, `guest_stars`; sub-endpoints `account_states`, `changes`, `credits`, `external_ids`, `images` (stills), `translations`, `videos`, `rating` (POST/DELETE) [verified list].

Air-date semantics: TV Bible says the episode `air_date` is the **earliest date the episode is available in its origin country**; there is **no air time / no UTC timestamp** anywhere in the API. (See 2.3.)

### 1.3 People

`GET /person/{id}` [verified]: `adult, also_known_as[], biography, birthday, deathday, gender (0 unset, 1 female, 2 male, 3 non-binary), homepage, id, imdb_id, known_for_department, name, place_of_birth, popularity, profile_path`.

| Sub-resource | Shape |
|---|---|
| `combined_credits` | `cast[] {media_type movie/tv, character, credit_id, release_date / first_air_date, episode_count (tv), order, popularity, vote_count, vote_average, genre_ids, poster_path, title/name...}`, `crew[] {job, department, ...}` [verified]. Also `movie_credits`, `tv_credits`. |
| `images` | `profiles[]` |
| `tagged_images` | `results[] {image_type still/poster, media{...}, media_type movie/episode, aspect_ratio, file_path, iso_639_1, vote_average, vote_count}` - the actor *in* a still [verified] |
| `external_ids` | `freebase_mid, freebase_id, imdb_id, tvrage_id, wikidata_id, facebook_id, instagram_id, tiktok_id, twitter_id, youtube_id` [recall] |
| `translations`, `changes`, `/person/latest`, `/person/popular` | |

### 1.4 Search

| Endpoint | Params [recall unless noted] | Notes |
|---|---|---|
| `/search/multi` | `query, include_adult, language, page` [verified] | results carry `media_type` movie/tv/person; persons include `known_for[]` |
| `/search/movie` | `query, include_adult, language, primary_release_year, page, region, year` | `year` matches any release year, `primary_release_year` the primary one |
| `/search/tv` | `query, first_air_date_year, include_adult, language, page, year` | |
| `/search/person` | `query, include_adult, language, page` | |
| `/search/keyword` | `query, page` -> `{id, name}` | use to resolve mood words to keyword ids |
| `/search/collection` | `query, include_adult, language, page, region` | |
| `/search/company` | `query, page` | |

Search is title/alt-title/translation substring match with some fuzziness; there is no field to search by original title only. `include_adult=false` still leaks unflagged porn (2.4).

### 1.5 Discover (all params)

`GET /discover/movie` [verified via mirror; typos in the mirror corrected]:

| Param | Meaning |
|---|---|
| `sort_by` | `popularity.asc/desc` (default desc), `primary_release_date.asc/desc`, `release_date.asc/desc`, `revenue.asc/desc`, `title.asc/desc`, `original_title.asc/desc`, `vote_average.asc/desc`, `vote_count.asc/desc` |
| `certification`, `certification.gte`, `certification.lte`, `certification_country` | must send `certification_country` with them (e.g. `certification_country=IN&certification.lte=U/A 13+` works only within that country's `order`) |
| `include_adult` (false), `include_video` (false) | |
| `language`, `region` | `region` re-scopes `release_date.*` and `with_release_type` to that country |
| `primary_release_year`, `primary_release_date.gte/.lte`, `release_date.gte/.lte`, `year` | |
| `with_release_type` | 1-6, pipe/comma; combine with `region` for "digital release in IN this week" |
| `vote_average.gte/.lte`, `vote_count.gte/.lte` | always send `vote_count.gte` (e.g. 50-200) or you get junk at the top of `vote_average.desc` |
| `with_runtime.gte/.lte` | minutes - the "fits tonight" filter |
| `with_genres`, `without_genres` | comma = AND, pipe = OR |
| `with_keywords`, `without_keywords` | comma = AND, pipe = OR |
| `with_companies`, `without_companies` | |
| `with_cast`, `with_crew`, `with_people` | person ids; comma AND / pipe OR |
| `with_origin_country`, `with_original_language` | ISO 3166-1 / ISO 639-1 |
| `with_watch_providers`, `without_watch_providers`, `watch_region`, `with_watch_monetization_types` | provider ids (comma AND / pipe OR); `watch_region` is **required** for the provider filters to do anything; monetization in `flatrate, free, ads, rent, buy` (pipe/comma) |
| `page` | 1-500 |

`GET /discover/tv` [verified via mirror; corrected]:

| Param | Meaning |
|---|---|
| `sort_by` | `popularity.asc/desc`, `first_air_date.asc/desc`, `name.asc/desc`, `original_name.asc/desc`, `vote_average.asc/desc`, `vote_count.asc/desc` (the mirror pastes the movie list here - `revenue`/`title` are **not** valid for TV) |
| `air_date.gte/.lte` | any episode airing in range - "shows airing this week" |
| `first_air_date.gte/.lte`, `first_air_date_year`, `include_null_first_air_dates` | |
| `timezone` | applies to air-date comparisons |
| `screened_theatrically` | bool |
| `with_networks` | network ids (e.g. Netflix 213, HBO 49) |
| `with_status` | 0 Returning Series, 1 Planned, 2 In Production, 3 Ended, 4 Cancelled, 5 Pilot (comma/pipe) |
| `with_type` | 0 Documentary, 1 News, 2 Miniseries, 3 Reality, 4 Scripted, 5 Talk Show, 6 Video |
| `with_genres/without_genres`, `with_keywords/without_keywords`, `with_companies/without_companies`, `with_origin_country`, `with_original_language`, `with_runtime.gte/.lte`, `vote_average.*`, `vote_count.*`, `include_adult`, `language`, `page` | as movies |
| `with_watch_providers`, `without_watch_providers`, `watch_region`, `with_watch_monetization_types` | as movies |

No `with_cast`/`with_crew` on discover/tv [recall]. Discover is capped at page 500 (10,000 results).

### 1.6 Trending and curated lists

| Endpoint | Params | Notes |
|---|---|---|
| `/trending/{all|movie|tv|person}/{day|week}` | `language` | items carry `media_type` [verified]. Computed from TMDB site activity (views/edits/votes); not region-aware. |
| `/movie/now_playing`, `/movie/upcoming` | `language, page, region` | response includes `dates {minimum, maximum}` [verified]; the window is based on theatrical release types 2/3 in `region` [recall] |
| `/movie/popular`, `/movie/top_rated` | `language, page, region` | `top_rated` applies a vote-count floor |
| `/tv/airing_today`, `/tv/on_the_air` | `language, page, timezone` | `on_the_air` = episodes in next 7 days [verified]; `airing_today` = today in `timezone` |
| `/tv/popular`, `/tv/top_rated` | | |
| `/person/popular` | | |

### 1.7 Watch providers

| Endpoint | Shape |
|---|---|
| `/watch/providers/regions` | `results[] {iso_3166_1, english_name, native_name}` - 195 regions in the doc example [verified] |
| `/watch/providers/movie`, `/watch/providers/tv` | `?watch_region=IN&language=` -> `results[] {provider_id, provider_name, logo_path, display_priority, display_priorities{IN: n, US: n, ...}}` [verified]. Use `display_priorities[region]` to order the picker. |
| `/movie/{id}/watch/providers`, `/tv/{id}/watch/providers`, `/tv/{id}/season/{n}/watch/providers` | `results{ IN: {link, flatrate[], free[], ads[], rent[], buy[]} }` each item `{provider_id, provider_name, logo_path, display_priority}` [verified]. `link` = TMDB's watch page for that title/region (which links to JustWatch), **not** a provider deep link. |

Hard rules: data belongs to JustWatch; the official doc says you **must attribute JustWatch** as the source or access is revoked [recall of the doc wording; consistent with forum]. No prices, no deep links, no "available since" or "leaving on" dates, no episode-level availability, no changes feed. Refresh cadence ~daily (JustWatch -> TMDB once per 24 h, live ~8 h later [snippet]).

### 1.8 Certifications, genres, configuration

- `/certification/movie/list`, `/certification/tv/list` -> `certifications{ US: [{certification, meaning, order}], GB: [...], IN: [...], ... }`. Movie list covers AR, AT, AU, BE, BG, BR, CA, CA-QC, CH, CL, CZ, DE, DK, ES, FI, FR, GB, GR, HK, HU, ID, IE, IL, IN, IT, JP, KR, LT, LU, LV, MO, MX, MY, NL, NO (+ more) [verified sample]. `order` lets you do "<= PG-13" comparisons within one country only.
- `/genre/movie/list` (19 genres), `/genre/tv/list` (16) with `language` [recall].
- `/configuration` [verified]: `images.secure_base_url = https://image.tmdb.org/t/p/`; `backdrop_sizes w300 w780 w1280 original`; `logo_sizes w45 w92 w154 w185 w300 w500 original`; `poster_sizes w92 w154 w185 w342 w500 w780 original`; `profile_sizes w45 w185 h632 original`; `still_sizes w92 w185 w300 original`; `change_keys[]` (full list: adult, air_date, also_known_as, alternative_titles, biography, birthday, budget, cast, certifications, character_names, created_by, crew, deathday, episode, episode_number, episode_run_time, freebase_id, freebase_mid, general, genres, guest_stars, homepage, images, imdb_id, languages, name, network, origin_country, original_name, original_title, overview, parts, place_of_birth, plot_keywords, production_code, production_companies, production_countries, releases, revenue, runtime, season, season_number, season_regular, spoken_languages, status, tagline, title, translations, tvdb_id, tvrage_id, type, video, videos).
- `/configuration/countries` (`iso_3166_1, english_name, native_name`), `/configuration/jobs` (`department, jobs[]`), `/configuration/languages` (`iso_639_1, english_name, name`), `/configuration/primary_translations` (`["en-US","hi-IN",...]`), `/configuration/timezones` (`iso_3166_1, zones[]`) [recall].

### 1.9 Keeping a cache fresh: changes + daily exports

- `GET /movie/changes`, `/tv/changes`, `/person/changes` with `start_date`, `end_date`, `page` -> `results[] {id, adult}` (default = last 24 h; **max 14-day window per query** [recall - the mirror omits the cap]). Poll daily, then re-fetch the ids you actually cache. [verified shape]
- `GET /movie/{id}/changes` (and tv, season, episode, person) -> `changes[] {key, items[] {id, action added/updated/deleted, time, iso_639_1, iso_3166_1, value, original_value}}` [verified]. Keys match `configuration.change_keys`. Watch-provider changes are **not** emitted here [snippet].
- Daily ID exports [verified live]: `https://files.tmdb.org/p/exports/{movie|tv_series|person|collection|tv_network|keyword|production_company}_ids_MM_DD_YYYY.json.gz`, one JSON object per line: `{id, original_title|original_name|name, popularity, adult, video}` [recall for fields]. Generated daily (~08:00 UTC), kept for a few months, no rate limit ("designed for once-daily consumption") [verified via api-evangelist]. They are **not** full metadata dumps - use them to (a) seed/validate your id space, (b) sort by `popularity` to prioritise warm-up, (c) detect deleted/merged ids.
- Image CDN has no rate limit; cache at your edge [verified via api-evangelist].

### 1.10 Find by external ID

`GET /find/{external_id}?external_source=` with `imdb_id | tvdb_id | wikidata_id | facebook_id | instagram_id | twitter_id | tiktok_id | youtube_id` [verified] -> `{movie_results[], person_results[], tv_results[], tv_episode_results[], tv_season_results[]}`. IMDb ids (`tt...`) resolve movies, shows and **episodes** (`tv_episode_results`); TVDB ids resolve shows/episodes. This is your bridge for Letterboxd (tmdbID/imdbID), Trakt (tmdb/imdb/tvdb), IMDb datasets, TV Time (tvdb), Wikidata.

### 1.11 Account, ratings, lists (v3 vs v4)

| Capability | v3 (`session_id`) | v4 (user `access_token`) |
|---|---|---|
| Login flow | `POST /authentication/token/new` -> user approves at `themoviedb.org/authenticate/{token}` -> `POST /authentication/session/new` [verified]; guest sessions for anonymous ratings | `POST /4/auth/request_token` (with `redirect_to`) -> approve at `themoviedb.org/auth/access?request_token=` -> `POST /4/auth/access_token` -> `access_token` + `account_id` [recall] |
| Rate a title | `POST /movie/{id}/rating {value}` (0.5-10), tv, tv episode | same v3 calls |
| Favorites / watchlist | `POST /account/{id}/favorite`, `/watchlist`; `GET /account/{id}/favorite/movies|tv`, `/watchlist/movies|tv`, `/rated/movies|tv|tv/episodes` (`sort_by created_at.asc|desc`, item carries `rating`) [verified] | `GET /4/account/{account_object_id}/movie|tv/favorites|watchlist|rated|recommendations` [recall] - `recommendations` = TMDB's personalised recs for that user |
| Lists | `POST /list` (`name, description, language`) with `session_id`; **movies only**; `POST /list/{id}/add_item`, `remove_item`, `GET /list/{id}/item_status`, `clear`, DELETE [verified] | `POST /4/list` (`name, description, iso_639_1, iso_3166_1, public`); `POST/PUT/DELETE /4/list/{id}/items` with `items[] {media_type movie|tv, media_id, comment}`; `GET /4/list/{id}` with `sort_by original_order|vote_average|primary_release_date|title .asc/.desc`; `item_status`; `clear`. Mixed movie+TV, per-item comments, public/private, backdrop [recall] |

Takeaway: use v4 only if you want to *sync* with a user's TMDB account (export their lists/ratings). For your own app you'll store journals yourself; TMDB's account APIs are optional import/export targets.

### 1.12 Images CDN

`https://image.tmdb.org/t/p/{size}{file_path}` (sizes in 1.8). Posters and logos have `iso_639_1`; backdrops are mostly `null` (textless). `include_image_language=hi,en,null` on `images` or via `append_to_response=images` picks the poster language set; the first poster in `posters[]` after sorting by `vote_average` is what the site shows. Person profiles: `w185`, `h632`. Episode stills: `w300`. No hotlink ban, no rate limit, but the ToU expects you not to strip attribution or re-host as your own asset library [recall].

### 1.13 Rate limits, attribution, terms - what you cannot do

- Rate: see 0. Practical: keep <= ~20-30 rps sustained per key, exponential backoff on 429 honoring `Retry-After`, one key per environment is fine ("no live/sandbox split").
- Attribution: notice text + logo rules (0). If you show watch providers you must **also** credit JustWatch.
- Commercial: the FAQ/forum line is that ads or a paid app is fine with attribution; anything "revenue-generating uses, AI/ML training, or sublicensing" wants a written agreement. A social journaling app with subscriptions sits in the grey zone - budget a support@ email before launch; the "API for Business" page exists precisely for that. [snippet + api-evangelist]
- Storage: 6-month cache cap (api-evangelist's reading of the ToU). Don't redistribute the data, don't build a "TMDB replacement", don't mass-download beyond the exports. [recall]
- Adult content: you are responsible for filtering; TMDB's flag is a porn flag only (2.4).
- Reviews and keywords can't be written via API (only ratings, favorites, watchlist, lists).

---

## 2. Data quality realities

### 2.1 Keywords
- Community-tagged, uncontrolled vocabulary. The Movie Bible suggests 15-20 keywords per movie, 5-10 per show; forbids quotes, taglines, actors, characters, networks, award names; warns against bulk-copying from IMDb. Moderators merge duplicates on request. [snippet: bible/movie/59f3b16d..., talk/58b00ab9, talk/588418309]
- Real-world: synonyms coexist ("alien" vs "ufo" vs "extraterrestrial"), tagging density is skewed to Hollywood; Indian/regional cinema and TV are sparse. Discover `with_keywords` uses AND by default - pipe-OR your synonym clusters.
- Practical: treat keywords as *signals* for mood clustering (keyword id -> your mood taxonomy), never as user-facing facets without curation.

### 2.2 Watch providers (JustWatch)
- Coverage is best in JustWatch's home markets (US, GB, DE) and good for IN for the big services (Netflix, Prime, Hotstar, Zee5, SonyLIV, JioCinema/JioHotstar) but with **lag and gaps**: users report titles showing providers on the TMDB website but not in the API for IN, and slow updates for Indian films [snippet: talk/63c0741a, talk/62e508a3]. Some countries lack rent/buy categories entirely [snippet: talk/633e6e73].
- No prices, deep links, expiry, "added on" dates, or episode-level availability -> the "leaving soon" and "new this week" features must be built by **diffing snapshots** you take (see 4.1) or by buying a provider API.
- Not in `/changes` -> you cannot know what changed without re-fetching.

### 2.3 Episode air dates & runtimes
- `air_date` is a date only; there is no air time. The bible rule (earliest availability in origin country) means a Netflix drop at 00:00 UTC is entered as the previous US calendar day, so the API looks "one day early/late" depending on where you are. [snippet: talk/660c1029, bible/tv/59f74328]
- Known bugs: `last_air_date` wrong on ended shows; `first_air_date` differing between list and detail endpoints. [snippet: talk/68291941]
- `episode_run_time` on the series object is frequently empty; per-episode `runtime` exists but is null for many episodes of older/regional shows. Movie `runtime` is 0/null on a long tail.
- `next_episode_to_air` is only as good as the contributors keeping the season ahead of time; for weekly network shows it's reliable, for Indian daily soaps it is not.

### 2.4 Adult flag
- `adult` means pornography only, set by whoever created the entry; `include_adult=false` still leaks unflagged titles in discover/search/trending; TV objects historically lacked a usable `adult` flag; `combined_credits` cannot be filtered. [snippet: talk/650b1fc1, talk/628f8584, talk/61520692, talk/64b08d4f, talk/61909f80]
- Mitigation: post-filter on `adult`, `vote_count`, and provider presence; keep a denylist of ids reported by users.

### 2.5 Anime
- TMDB's rule is **absolute (continuous) numbering** as the default season structure for anime; "seasons", cours, arcs, DVD orders live in `episode_groups`. Editors and moderators have fought about this for years; entries get locked. [snippet: talk/697d0680, talk/6996a5a1, talk/63283b9b; MediaElch #492]
- Consequence: a Crunchyroll "Season 3 Episode 1" may be TMDB S1E37. If you import from Trakt/Simkl (which use TVDB-style seasons) you need the episode-group mapping or TVDB ids via `find`.

### 2.6 Other gaps you will hit
- Overviews/taglines missing in non-English locales; fallback logic (`language=hi-IN` then `en-US`, or read `translations`) is mandatory.
- `budget`/`revenue` are 0 on most titles; Wikidata/Box Office Mojo are better.
- `vote_average` on titles with < 50 votes is noise; TMDB's own top-rated pages apply a floor.
- Certifications: `release_dates.certification` is present for US/GB reliably, patchy for IN (CBFC `U`, `U/A`, `A`, and the newer `U/A 7+ / 13+ / 16+`).
- Trending is global, not per-region - "trending in India" needs discover with `region`/`with_origin_country` + your own signals.
- Duplicate/merged ids happen; a fetched id can 404 later - handle by checking the daily export or `find` via IMDb id.

---

## 3. Adjacent sources

### 3.1 Metadata, ratings, awards, structure

| Source | What it gives you | Access / limits | License / gotchas | Doc |
|---|---|---|---|---|
| **OMDb** | `imdbRating`, `imdbVotes`, `Metascore`, `Ratings[] {Source: "Internet Movie Database" / "Rotten Tomatoes" / "Metacritic", Value}`, `Rated` (MPAA), `Awards` (free text: "Won 2 Oscars. 154 wins & 220 nominations"), `BoxOffice`, `Runtime`, `Plot`, `Director`, `Writer`, episode lookups (`Season`, `Episode`) | Free key: **1,000 req/day**. Patreon from ~$1/mo unlocks the Poster API and higher quotas (up to ~100k/day at higher pledges; tiers not published on the site) | Crowd-maintained; RT/Metacritic values lag and are sometimes missing. Lookup by `i=tt...` (from TMDB `external_ids.imdb_id`) or `t=`. Legally the cleanest way to *show* an RT/MC number without scraping, but OMDb's own license is thin - show as "via OMDb". | omdbapi.com/apikey.aspx [verified]; github.com/api-evangelist/omdb [verified] |
| **Wikidata SPARQL** | Awards received (P166) with qualifiers, nominations (P1411), box office (P2142), cost (P2130), based on (P144), follows/followed by (P155/P156), part of series (P179), derivative work (P4969), main subject (P921), narrative/filming location (P840/P915), original language (P364), TMDB movie id **P4947**, TMDB TV id **P4983**, TMDB person id **P4985**, TMDB collection id **P11805**; plus IMDb (P345), RT (P1258), Metacritic (P1712), Letterboxd (P6127) ids | Public endpoint `query.wikidata.org/sparql`. **60 s** query deadline; 60 s CPU per 60 s per client; 30 error queries/min; **5 parallel queries per IP**; 429 + `Retry-After`; must send a descriptive `User-Agent` or be blocked | CC0. Coverage is excellent for awards/sequels of well-known films, patchy for Indian TV. Also reachable with no SPARQL via `https://www.wikidata.org/wiki/Special:EntityData/Q25188.json` (TMDB `external_ids.wikidata_id`). | mediawiki.org/wiki/Wikidata_Query_Service/User_Manual [verified]; wikidata.org/wiki/Property:P4947 [verified] |
| **Wikipedia REST** | `GET https://en.wikipedia.org/api/rest_v1/page/summary/{title}` -> `title, displaytitle, wikibase_item (Q-id), description ("2010 film by Christopher Nolan"), extract, extract_html, thumbnail, originalimage, content_urls, timestamp` | Wikimedia-wide limits: 10 req/min with no identifying UA; **200 req/min** with a compliant User-Agent; more with an API token. | CC BY-SA 4.0 -> attribute and link. Resolve title via Wikidata sitelinks from `wikidata_id`. | en.wikipedia.org/api/rest_v1/page/summary/Inception [verified]; mediawiki.org/wiki/Wikimedia_APIs/Rate_limits [verified] |
| **IMDb non-commercial datasets** | Daily TSVs at datasets.imdbws.com: `title.basics` (tconst, titleType, primaryTitle, originalTitle, isAdult, startYear, endYear, runtimeMinutes, genres), `title.ratings` (averageRating, numVotes), `title.crew`, `title.episode` (parentTconst, seasonNumber, episodeNumber), `title.principals`, `title.akas` (region, language, isOriginalTitle), `name.basics` | Bulk download, refreshed daily; no API | **Personal / non-commercial only** - you cannot ship IMDb ratings from these in a commercial app. Fine for offline experiments and as a research join key. | data.imdb.com/non-commercial-datasets [verified] |
| **MovieLens** | ml-32m (32M ratings, 200,948 users, 87,585 movies, 2M tags, tag-genome), ml-25m, ml-latest; `links.csv` = `movieId, imdbId, tmdbId` so you can map straight to TMDB | Download | Research/non-commercial, no redistribution, cite the paper; `tmdbId` missing for a small share of rows. Great for bootstrapping an item-item similarity model before you have your own ratings. | grouplens.org/datasets/movielens [verified] |
| **TVmaze** | Schedules by country/date (`/schedule?country=IN&date=`), web/streaming schedule, full future schedule, episodes with **`airstamp` (ISO 8601 with time + zone)** and `airtime`, show lookup by `thetvdb`/`imdb`, cast/crew, AKAs, `updates` | "At least 20 calls / 10 s per IP"; premium tiers (Bronze/Silver/Gold; prices not shown) add a read-write user API | **CC BY-SA** - credit + link. Best free source for **air times** and network schedules; US-centric but has IN channels. No TMDB id (bridge via IMDb/TVDB). | tvmaze.com/api [verified] |
| **TheTVDB v4** | Series with **multiple season types** (`default/official/dvd/absolute/alternate/regional`), episodes, artwork, translations, `updates?since=`, `search?query&type&remote_id`, awards, characters, companies, content ratings, lists, movies | Company revenue < $50k/yr: free with attribution; $50k-250k: $1,000/yr; $250k-1M: $10,000/yr; bigger: custom. Alternative: "user-supported" key where each user pays TheTVDB **$11.99/yr** and enters a PIN in your app. | Attribution with a direct link required. The anime-season-order problem (2.5) is what TVDB's season types solve. | thetvdb.com/api-information, thetvdb.com/subscribe, github.com/thetvdb/v4-api, thetvdb.github.io/v4-api [verified] |

### 3.2 Streaming availability

| Source | What | Cost / limits | Notes |
|---|---|---|---|
| **TMDB watch/providers** (JustWatch) | see 1.7 | free | no deep links / dates / prices; must credit JustWatch |
| **Streaming Availability API** (Movie of the Night, v4) | 65 countries, 3,380 catalogs. `GET /shows/{id}` accepts `tmdb:movie/238`, `tv/1396`, `tt0068646`; `streamingOptions{country: [{service, type subscription/free/rent/buy/addon, link (deep link), videoLink, quality, audios[], subtitles[], price, expiresSoon, expiresOn, availableSince, addon}]}`; `series_granularity show/season/episode`; `/shows/search/filters` (catalogs, genres, year, rating, keyword, order_by); `/shows/top` (official top-10s for Netflix, Prime, Disney+, Apple, Max, Crunchyroll, Crave, Hulu); **`/changes`** with `change_type new/updated/removed/expiring/upcoming`, `item_type show/season/episode`, 31-day windows, cursor paging | Free $0 = **1,000 req/mo**; Starter $49 = 25k; Growth $99 = 100k; Scale $299 = 1M. Hard caps, no overage; **commercial use allowed on every tier including free** | This is the cheapest way to get *dates* (expiresOn, availableSince) and deep links. `upcoming` only for Apple/Disney+/Max/Netflix/Prime/Mubi. | movieofthenight.com/about/api/pricing, docs.movieofthenight.com/resource/shows, /resource/changes [verified] |
| **Watchmode** | 54 countries; sources per title (sub/free/purchase/rent/tve/addon) with web + iOS + Android deep links; title metadata; search by `tmdb_movie_id`/`tmdb_tv_id`/`imdb_id`; daily changes (new titles, source changes); episode-level sources | Free "Developer": **2,500 credits/mo, non-commercial, 3 countries**; Startup $349/mo 40k credits; Business $599/mo 100k; Enterprise = full dataset via S3/sFTP | Pricier than Movie of the Night; free tier is non-commercial. | api.watchmode.com [verified] |
| **JustWatch official** | 120+ countries, deep links, prices, new/leaving | B2B only, contact data-partner@justwatch.com; no self-serve | The unofficial GraphQL wrappers (npm `justwatch-api`, python `simple-justwatch-python-api`, still updated mid-2026) are explicitly "not for commercial use", unsupported, and break without notice. Don't build a product on them. | justwatch.com/us/JustWatch-Streaming-API [verified] |

### 3.3 Trailers / video

| Source | What | Cost | Notes |
|---|---|---|---|
| **TMDB videos** | YouTube keys with `type`, `official`, `published_at`, per-language | free | Coverage is good for English trailers; Hindi/regional dubs are hit-or-miss. Embed via YouTube IFrame - **no API quota** consumed. |
| **Kinocheck** | `/movies?tmdb_id=` or `imdb_id=`, `/shows`, `/trailers/trending`, `/trailers/latest`; returns YouTube ids + thumbnails; categories Trailer/Teaser/Clip/Featurette; `en`/`de`; partners with studios so some Netflix/Apple/Prime originals are "exclusive verified" | Free, **1,000 req/day**; key (`X-Api-Key`, `X-Api-Host`) for more; custom deals for scale | Good fallback when TMDB has no trailer; German-first company. | api.kinocheck.com [verified] |
| **YouTube Data API** | `videos.list` (1 unit) to check a key is public/embeddable/regionRestricted; `search.list` for trailer discovery | 10,000 units/day general; **`search.list` capped at 100 calls/day since 2026-06-01** (own bucket); `videos.insert` 100/day; quota resets midnight PT | Never use `search.list` per title in production; use TMDB/Kinocheck keys and only `videos.list` in batches of 50 ids (`id=a,b,c` = 1 unit). | developers.google.com/youtube/v3/determine_quota_cost, /revision_history [verified] |

### 3.4 Content warnings / family suitability

| Source | What | Access | Notes |
|---|---|---|---|
| **Does The Dog Die** | Crowd-voted trigger topics per title: search (`/dddsearch?q=` / v3 items search), item details with `topicItemStats[] {topicId, topicName, yesSum, noSum, numComments}` and comments | Free key from your DDTD profile page, header `X-API-KEY`; rate limits not published; site returns 403 to bots, so verify the current v3 paths at doesthedogdie.com/api/3.0 [unverified specifics] | Titles are matched by name (they keep IMDb/TMDB ids internally but the search is text). Perfect for a "content warnings" panel with attribution; don't cache forever - votes change. |
| **Common Sense Media** | Age rating, "what parents need to know", content grid (violence, sex, language, drinking, consumerism) | **Licensed partner API only** (contact form; no self-serve, no published price) | Not for an indie launch. |
| **TMDB `release_dates.certification` / `content_ratings`** | Age ratings per country | free | The only free structured rating; `descriptors` mostly empty. |
| **Rotten Tomatoes / Metacritic** | Tomatometer, audience score, Metascore | **No public API.** RT's legacy API (via Fandango) is closed; both ToS forbid scraping; Apify/ScrapingBee "scraper APIs" exist but you carry the legal risk. | Show RT/MC numbers only via OMDb's `Ratings[]` (with "via OMDb"), or link out. Trakt exposes `rt_tomatometer`/`metascore` sort keys but only to VIP users. |

### 3.5 Tracker platforms (sync partners)

| Source | Offers a third party | Limits | Terms |
|---|---|---|---|
| **Trakt API v2** [verified from blueprint] | OAuth (redirect or device-code), `/sync/history` (records `{id, watched_at, action scrobble/checkin/watch, type movie/episode, movie{title, year, ids{trakt, slug, imdb, tmdb}}, episode{season, number, title, ids{trakt, tvdb, imdb, tmdb}}, show{...}}`), `/sync/watched`, `/sync/collection`, `/sync/ratings`, `/sync/watchlist`, `/sync/favorites`, `/sync/playback`, `/sync/last_activities` (cheap poll), `/scrobble/start|pause|stop`, `/checkin`, calendars (`my/shows`, `my/shows/new|premieres|finales`, `my/movies`, `my/streaming` = US streaming release dates, `my/dvd`, and `all/*`), `/search/{imdb|tmdb|tvdb|trakt}/{id}?type=`, `/shows/{id}/progress/watched`, `/shows/{id}/next_episode`, `/movies/boxoffice` (US weekend top 10, Mondays), `/movies|shows/trending|popular|anticipated|played|watched|collected`, `/recommendations/movies|shows`, users' lists/follows/comments, `extended=full` (adds tagline, overview, released, runtime, country, trailer, homepage, status, rating, votes, comment_count, languages, available_translations, genres, certification) and `extended=images` | GET: **1,000 calls / 5 min** (authed and unauthed each); POST/PUT/DELETE: 1/s; 429 + `Retry-After`; `X-Ratelimit` header. VIP-only methods return 426 (open `X-Upgrade-URL`); "VIP Enhanced" limits return 420. VIP-only sorts: `imdb_rating, tmdb_rating, rt_tomatometer, rt_audience, metascore, votes` | **Images must be cached, hotlinking is blocked.** Comments >= 5 words, English. Dates ISO 8601 GMT. Free for apps (register a client). |
| **Simkl API** [verified from blueprint] | OAuth or PIN flow (non-expiring tokens); `/sync/all-items/{type}/{status}?date_from=`, `/sync/history` (POST, `allow_rewatch=yes`), `/sync/ratings`, `/sync/watched`, `/sync/activities`, `/search/id?imdb=|tmdb=|tvdb=|mal=|anilist=`, `/redirect`, `/ratings` (Simkl + IMDb + MAL scores), anime-first data (`/anime/{id}`, MAL/AniList ids), `/scrobble`, pre-built JSON: calendar (`data.simkl.in/calendar/`, 34 days, regenerated every 6 h) and trending (hourly) | 429 = rate limit ("in dev"), 412 = total request limit exceeded; numbers not published | Free if your app earns **< $150/month**; above that, commercial license via Discord. Attribution "Simkl Trending ..." in section titles; cache images forever by URL. |
| **TV Time** | **Shut down 2026-07-15**; accounts deleted. Only legacy GDPR export files exist. | - | Import path only (3.6). |
| **Letterboxd** | No public API (members-only, by application). Export/import CSV only. | - | 3.6 |
| **TVmaze premium** | Read-write user API for subscribers | see 3.1 | |

### 3.6 Import formats ("bring your history")

| Platform | Where the user gets it | Format | Matching key you'll have |
|---|---|---|---|
| **Letterboxd** | Settings > Import & Export > Export your data (ZIP) | `diary.csv` (Date, Name, Year, Letterboxd URI, Rating, Rewatch, Tags, Watched Date), `watched.csv` (Date, Name, Year, Letterboxd URI), `ratings.csv` (+Rating), `reviews.csv` (+Rating, Rewatch, Review, Tags, Watched Date), `watchlist.csv`, `likes/films.csv`, `lists/*.csv` (two header blocks, then Position, Name, Year, URL, Description), `comments.csv`, `profile.csv` [recall; column set for Name/Year/Letterboxd URI verified via the mapper README] | **No IMDb/TMDB ids in exports** -> match on Name+Year (`/search/movie?query&year`), keep the Letterboxd URI as a stable foreign key. Letterboxd's own *importer* accepts `Title, Year, Directors, imdbID, tmdbID, LetterboxdURI, WatchedDate, Rating (0.5-5), Rating10, Tags, Review, Rewatch` [verified partial: tmdbID/imdbID/LetterboxdURI exact-match, else Title/Year/Directors best-guess] - so you can *export to* Letterboxd cleanly. |
| **Trakt** | Settings > Data > "Export now" (free accounts too) | ZIP of JSON, split by type and paginated (`history-movies-1.json`, `ratings-seasons-1.json`, watchlist, lists, collection, comments); records mirror the API objects above (`watched_at`, `ids{trakt, imdb, tmdb, tvdb, slug}`). Per-list CSV download is VIP-only. | **tmdb ids present** -> direct match; episodes carry `tmdb` episode id + season/number. |
| **TV Time (legacy)** | GDPR self-service export (pre-shutdown) | `tracking-prod-records-v2.csv` (shows/episodes), `tracking-prod-records.csv` (movies), separate `ratings-*` files; JSON/CSV mix [snippet]. Exact headers not verifiable today - inspect a sample; shows/episodes were keyed by **TVDB** series/episode ids, movies by TMDB ids [recall]. | `find/{tvdb_id}?external_source=tvdb_id` for shows/episodes. |
| **Simkl** | Settings > Export (JSON/CSV/XML-style backups) | API objects with `ids{simkl, imdb, tmdb, tvdb, mal, anilist}` | tmdb ids present. |
| **Netflix** | (a) Account > Profiles > Viewing activity > "Download all" -> CSV with `Title, Date` [verified]; (b) Account > Security > "Get My Info" (full GDPR export, takes days) -> `ViewingActivity.csv` with `Profile Name, Start Time (UTC), Duration, Attributes, Title, Supplemental Video Type, Device Type, Bookmark, Latest Bookmark, Country` [verified via analyses] | Episode titles are strings like `"Show: Season 1: Episode Title"` (or `"Show: Limited Series: ..."`); trailers/autoplay rows have `Supplemental Video Type` set - drop them; `Duration` lets you drop < 5-min accidental plays. | **Titles only**: parse show/season/episode with regex, then `/search/tv` + `/tv/{id}/season/{n}` name match. Expect ~85-90% auto-match; queue the rest for user confirmation. |
| **Prime Video** | primevideo.com/settings/watch-history shows history but has no export button. Official route: Amazon Privacy Central > "Request My Data" > Prime Video category -> ZIP with `Digital.PrimeVideo.Viewinghistory*.csv` (titles + playback timestamps + device/location columns) [unverified column names; delivery takes up to ~30 days]. Community console script exports `Date Watched, Type, Title, Episode Title, GTI, Episode GTI, Path, Episode Path, Image URL` [verified]. | Titles only (GTIs are Amazon-internal). | Same title-matching pipeline as Netflix. |
| **IMDb** | Your Ratings / lists > Export (CSV: `Const` (tt id), `Your Rating`, `Date Rated`, `Title`, `Year`, `Title Type`, ...) | | `find/{tt}?external_source=imdb_id`. |

---

## 4. Concrete feature ideas (endpoint + caveat)

### 4.1 "Leaving soon on your services"
- **TMDB-only version**: for each title on a user's watchlist/lists, fetch `/movie|tv/{id}/watch/providers` daily (append it to your nightly refresh), store `{title, region, provider_id, type}` snapshots, and diff. A provider that was in `flatrate` yesterday and absent today = "just left"; you can't *predict* leaving. Cost: one call per title per day - fine for a few thousand hot titles; use the user's `watch_region` and intersect with their selected `provider_id`s. Caveat: JustWatch lag (~1 day), no expiry dates, false positives when JustWatch temporarily drops a listing (require 2 consecutive misses).
- **Predictive version**: Streaming Availability API `/changes?country=in&change_type=expiring&item_type=show&catalogs=netflix,prime` (31-day windows, cursor) -> `expiresOn` per streaming option; join on `tmdb` id. Free tier's 1,000 req/mo covers a daily pull for a few catalogs; Starter $49 for real usage. Watchmode also has expiring/changes but the free tier is non-commercial.

### 4.2 "New on your services this week"
- TMDB: `/discover/movie?watch_region=IN&with_watch_providers=8|119|122&with_watch_monetization_types=flatrate&sort_by=popularity.desc` gives *what's on*, not *what's new*. Get "new" by diffing the top N pages of that query daily (ids that appear for the first time), or by snapshot diff as in 4.1. Also `/discover/movie?region=IN&with_release_type=4&release_date.gte=...` for **digital releases** this week (release type 4 = Digital), which is often the "new on streaming" signal for films.
- Streaming Availability `/changes?change_type=new` or `/shows/top?service=netflix&country=in` (official top-10) for a cheap "what everyone's watching on Netflix India" shelf.
- Caveat: TMDB has no "added on" date; deep links must go to the provider's search or a JustWatch link; JustWatch attribution.

### 4.3 Release radar for followed directors/actors
- Follow = person id. Nightly: `/person/{id}/combined_credits` and keep entries with `release_date`/`first_air_date` >= today or missing, status from `/movie/{id}` (`Post Production`, `Planned`) - or cheaper, `/discover/movie?with_people={id}&primary_release_date.gte=today&sort_by=primary_release_date.asc` and `/discover/movie?with_crew={id}...` (`with_cast` for actors; discover/tv has no person filter - use `tv_credits`). Poll `/person/changes` (14-day window) to learn when a followed person's credits changed.
- For dates that matter to *this user*, use `/movie/{id}/release_dates` filtered to their country and type 3 (theatrical) / 4 (digital).
- Caveat: rumored/unreleased projects have thin data; use `vote_count`/`popularity` to hide noise.

### 4.4 Runtime-fits-tonight
- `/discover/movie?with_runtime.gte=80&with_runtime.lte=105&watch_region=IN&with_watch_providers=...&with_watch_monetization_types=flatrate|free|ads&vote_count.gte=100&sort_by=popularity.desc`. For TV: pick shows where remaining episodes' `runtime` sum fits (`/tv/{id}/season/{n}` gives per-episode runtime).
- Caveat: `runtime` is missing on a long tail (filter excludes them silently); `episode_run_time` often empty - always use per-episode runtime.

### 4.5 Watch order for franchises
- `belongs_to_collection` on movie details -> `/collection/{id}` -> `parts[]` sorted by `release_date` = release order. Story/chronological order isn't in TMDB; get it from Wikidata (`P155`/`P156` follows/followed by, `P179` series with `P1545` series ordinal) or curate. For shared universes (MCU) use `with_companies`/`with_keywords` + curated lists.
- Spin-offs/remakes: `/movie/{id}/keywords` often includes "remake", "sequel", "prequel", "based on novel or book" - useful as a hint, not truth (4.12).
- Caveat: collections are movie-only; TV franchises need keywords/companies + manual curation.

### 4.6 Episode calendar with timezone
- Shows the user tracks: `/tv/{id}` -> `next_episode_to_air`, `last_episode_to_air`, `status`, `in_production`; per-season `/tv/{id}/season/{n}` for the full slate. `/discover/tv?air_date.gte&air_date.lte&timezone=Asia/Kolkata&with_networks=` for the network view.
- TMDB gives **dates only** and follows origin-country date rules (2.3). For actual air *times*, add TVmaze (`/lookup/shows?imdb=tt...` then `/shows/{id}/episodes` -> `airstamp` ISO 8601 with zone; `/schedule?country=IN&date=`) or Trakt `calendars/my/shows` (times in GMT). Present "drops Friday (India time)" with a "confirm from provider" caveat for streaming shows.
- Caveat: TMDB's air date can be off by one for global 00:00 UTC drops; TVmaze is CC BY-SA (credit); TVmaze has no TMDB ids (bridge via IMDb/TVDB ids from `/tv/{id}/external_ids`).

### 4.7 "What did the cast do together before"
- For two person ids A,B: `/discover/movie?with_people=A,B` (comma = AND) gives every movie both were in. For TV: intersect `/person/A/tv_credits` and `/person/B/tv_credits` client-side. For a whole cast: `/movie/{id}/credits` -> top-N cast ids -> pairwise `with_people` (or precompute from `combined_credits`). Also director-actor pairs: `with_crew=D&with_cast=A`.
- Caveat: TV credits from `credits` are current-season only - use `aggregate_credits`.

### 4.8 Content warnings
- Age ratings: `/movie/{id}/release_dates` (per-country `certification`, sometimes `descriptors`), `/tv/{id}/content_ratings`; lists from `/certification/*/list` to render the meaning. Trigger topics: Does The Dog Die (search by title, show `yesSum/noSum` per topic with attribution and a "vote on DDTD" link). Keywords as weak hints ("gore", "sexual violence").
- Caveat: DDTD is crowd-voted and title-matched; CSM is licensed-only; TMDB `descriptors` almost always empty.

### 4.9 Original-language / country cinema exploration
- `/discover/movie?with_original_language=ml&sort_by=vote_average.desc&vote_count.gte=50` (Malayalam), `with_origin_country=KR|JP`, `region=IN` to scope release dates; `/configuration/languages` and `/configuration/countries` for the picker; `/watch/providers/movie?watch_region=IN` to intersect with what's actually watchable.
- Caveat: `vote_count` distributions differ wildly by language - normalise thresholds per language; overviews may only exist in the original language -> read `translations`.

### 4.10 Keywords as moods
- Build a mood taxonomy -> keyword-id clusters (`/search/keyword?query=slow burn`, `/keyword/{id}`), then `/discover/*?with_keywords=id1|id2|id3` (pipe-OR within a mood, comma-AND across moods) plus genre/runtime. Use `/movie/{id}/keywords` on what the user rated highly to infer their mood vocabulary.
- Caveat: synonyms and thin tagging (2.1); Indian titles under-tagged; never expose raw keyword names without curation. MovieLens tag-genome is a better offline mood signal if you can map by `tmdbId` for research.

### 4.11 Poster language choice
- `/movie/{id}/images?include_image_language=hi,en,null` (or `append_to_response=images&include_image_language=...`) and pick `posters[]` with `iso_639_1` matching the user's UI language, else `null` (textless), else `en`; same for `logos[]` (title treatments) to build "textless backdrop + localized logo" hero cards. Sizes from `/configuration`.
- Caveat: many titles have only an `en` poster; per-user posters mean per-user cache keys.

### 4.12 Trailer shelf
- `/movie/{id}/videos?include_video_language=hi,en` -> prefer `type=Trailer`, `official=true`, newest `published_at`; embed the YouTube key with the IFrame player (no quota). Fallback: Kinocheck `/movies?tmdb_id=` (1,000/day free). Validate keys in bulk with YouTube `videos.list?id=a,b,c…&part=status,contentDetails` (1 unit per call of up to 50 ids) to drop private/region-blocked videos.
- Caveat: never use `search.list` per title (100/day cap); regional dubs are inconsistent in TMDB.

### 4.13 "Is this a remake / sequel / based on…"
- Sequel/prequel: `belongs_to_collection` + `parts[]` ordering; keywords "sequel"/"prequel"/"remake"/"reboot"/"based on novel or book"/"based on true story"/"based on comic"; Wikidata: `P144` (based on -> the book/film with author), `P155/P156`, `P4969` derivative works, `P31` instance of "remake"/"film adaptation" (Q…); `P1889` different from.
- Caveat: TMDB has no typed relations beyond collections; keyword presence is not reliable; Wikidata coverage strong for Hollywood/major Indian films, weak for TV.

### 4.14 "On this day" anniversaries
- Precompute from your cached titles: `release_date` (movie) or `first_air_date`/episode `air_date` month-day matches; for user-relevance use their diary (what they watched on this day last year) plus `/discover/movie?primary_release_date.gte=YYYY-MM-DD&primary_release_date.lte=YYYY-MM-DD&sort_by=popularity.desc` for each past year (10-20 calls, cache daily). People: `birthday`/`deathday` from person details.
- Caveat: `release_date` is the *primary* (earliest, often festival) date; use `release_dates` type 3 in the user's region for "released in India on this day".

### 4.15 Rewatch season for a returning show
- Trigger: `/tv/{id}` `status = Returning Series` and `next_episode_to_air` with `season_number` > user's last logged season, or `in_production=true` and a new season appears in `seasons[]`; poll `/tv/changes` (14-day windows) for tracked ids and look for `season`/`episode` keys. Offer "rewatch S1-S3 before S4 drops on {air_date}" with per-episode runtimes summed and a per-day pace.
- Caveat: `next_episode_to_air` is null until contributors add the episode; `last_air_date` bug; for Indian shows expect data to arrive late.

### 4.16 Spoiler-safe episode pages
- Gate everything below the user's progress: episode `name`, `overview`, `still_path`, `guest_stars`, ratings and TMDB `reviews` all leak plot. Render only `air_date`, `episode_number`, `runtime` for unwatched episodes; blur stills; hide `episode_type=finale` badges optionally. Season posters (`seasons[].poster_path`) are safe; series `overview` is generally safe.
- Caveat: TMDB episode overviews are contributor-written and *frequently* spoil (no spoiler flag exists); person `combined_credits` reveal character deaths via `episode_count`, and `aggregate_credits.roles[].episode_count` leaks who leaves the show - hide counts until watched.

### 4.17 Extra ideas that fall out of the inventory
- **"Certified for my kids"**: `certification_country=IN&certification.lte=U/A 13+` via discover, with `content_ratings` for TV.
- **"Festival premieres"**: `release_dates` type 1 with `note` ("Cannes", "TIFF") -> "premiered at Cannes 2025".
- **"Where it was shot / set"**: Wikidata `P915`/`P840` -> map pins.
- **"Awards shelf"**: Wikidata `P166` with `P585` (point in time) and `P1686` (for work) -> "Best Actor, National Film Awards 2023"; OMDb `Awards` string as fallback.
- **Guest-session ratings sync**: let users push their 1-10 ratings to TMDB with v3 guest sessions or v4 tokens (`POST /movie/{id}/rating`) as a "back up to TMDB" feature.
- **"Import from Netflix"**: parse `ViewingActivity.csv` (drop rows with `Supplemental Video Type`, `Duration` < 5 min), regex `^(?<show>.+?): (?:Season (?<s>\d+)|Limited Series|Part \d+): (?<ep>.+)$`, resolve via `/search/tv` then season episode name match; movies via `/search/movie?query&year`.

---

## 5. Costs and limits table

| Source | Free tier | Paid | Rate limit | Commercial use | Attribution | Key data unique to it |
|---|---|---|---|---|---|---|
| TMDB v3/v4 | Everything (148 endpoints, images, exports) | Negotiated only | ~40-50 rps soft ceiling; 429 | Ads/paid apps OK with attribution; bigger = written agreement | "This product uses the TMDB API but is not endorsed or certified by TMDB." + logo rules; JustWatch credit for providers | Core catalog, images, credits, providers (no dates/links), changes feed |
| OMDb | 1,000/day | Patreon from ~$1/mo; Poster API patrons only; up to ~100k/day at higher pledges | per-day quota | Unclear/thin; treat scores as "via OMDb" | none stated | IMDb/RT/Metacritic scores, Awards, MPAA `Rated`, BoxOffice |
| Streaming Availability API | 1,000 req/mo | $49 / $99 / $299 per mo (25k / 100k / 1M) | hard monthly cap | Yes on all tiers | none stated | deep links, prices, `expiresOn`, `availableSince`, changes feed, official top-10s |
| Watchmode | 2,500 credits/mo, 3 countries, **non-commercial** | $349 / $599 per mo; enterprise dump | monthly credits | Paid tiers only | required on free | deep links (web/iOS/Android), episode-level sources, changes |
| JustWatch (official) | - | B2B contract | - | Yes | - | most countries (120+) |
| Kinocheck | 1,000 req/day | custom | daily | Not stated (partner-friendly) | - | verified studio trailers, `en`/`de` |
| YouTube Data API | 10,000 units/day; `search.list` 100 calls/day | quota increase via audit | daily, resets midnight PT | Yes (ToS) | YouTube branding rules | video status/embeddability |
| TVmaze | all read endpoints | premium user API (Bronze/Silver/Gold) | >= 20 calls / 10 s per IP | Yes | **CC BY-SA** credit + link | air **times** (`airstamp`), schedules by country |
| TheTVDB v4 | company revenue < $50k/yr | $1k / $10k / custom per yr, or $11.99/yr per user | not published | tiered | direct link required | season types (absolute/dvd/alternate), anime orders |
| Trakt | full API | user VIP unlocks some methods/sorts | 1,000 GET / 5 min; 1 POST/s | Yes (register app) | cache images, no hotlinking | user history/scrobbles/watchlists, calendars incl. US streaming/DVD, box office |
| Simkl | full API if app revenue < $150/mo | commercial license above | 429/412, unpublished | conditional | "Simkl ..." section titles, links | anime ids (MAL/AniList), 34-day calendar JSON |
| Wikidata | all | - | 60 s/query, 5 parallel/IP, 30 errors/min | Yes (CC0) | none required | awards, based-on, sequel chains, box office, all external ids |
| Wikipedia REST | all | - | 200 req/min with UA | Yes | CC BY-SA 4.0 | summaries, thumbnails |
| IMDb datasets | daily TSVs | - | - | **No** (personal/non-commercial) | required | ratings, episodes, akas |
| MovieLens | ml-32m etc. | - | - | **No** (research) | cite | ratings + tag genome with `tmdbId` |
| Does The Dog Die | API key | - | unpublished | ask them | expected | trigger topics with vote counts |
| Common Sense Media | - | licensed partners | - | licensed | required | age ratings, content grid |
| Rotten Tomatoes / Metacritic | none | none | - | scraping forbidden | - | use OMDb or link out |

---

## Sources (URLs)

TMDB (official; blocked from this environment - content via mirror/snippets):
- https://developer.themoviedb.org/docs/getting-started , /docs/rate-limiting , /docs/append-to-response , /docs/image-basics , /docs/daily-id-exports , /docs/tracking-content-changes , /docs/faq
- https://developer.themoviedb.org/llms.txt (Markdown index; append `.md` to any doc URL)
- https://developer.themoviedb.org/reference/discover-movie , /reference/discover-tv , /reference/movie-watch-providers , /reference/find-by-id , /reference/configuration-details , /reference/tv-series-details
- https://www.themoviedb.org/api-terms-of-use , https://www.themoviedb.org/api-for-business
- TMDB Talk: rate limiting talk/5d34aec717792c0011bc9bd9 ; commercial terms talk/592c8779c3a3680fc20012d5 , talk/681a1956bbbf46d7f66404f9 , talk/697df2a0576e95a402e4e71e ; API future talk/69b5b90166f46a7d63ce5dcf ; JustWatch pipeline talk/616024f469eb900061e200f8 , talk/673f68df46541bbcd379ee55 , talk/63de2458373ac200cafd16e6 , talk/63c0741aed96bc009132c9a7 , talk/62e508a3f1b571005955d761 , talk/633e6e73fb8346007936fb52 ; keywords talk/58b00ab99251411a6400aec9 , bible/movie/59f3b16d9251414f20000007 ; air dates talk/660c10295aadc4016363a053 , talk/68291941b1b47c49e85b52e5 , talk/5341aa400e0a2679a4002886 , bible/tv/59f743289251416e71000037 ; adult flag talk/650b1fc1b1f68d011df6dd4d , talk/628f85842495ab540a1ba3c2 , talk/61520692af58cb006537793d , talk/64b08d4fba480200e615b538 ; anime talk/697d0680d564e13094e4e270 , talk/6996a5a14fbedd07461b0bdb , talk/63283b9b0f21c6007faa71d6
- Mirrors: https://sirjosh.mintlify.app/llms.txt (per-endpoint `.md` pages) ; https://github.com/api-evangelist/tmdb (openapi/, rate-limits/tmdb-rate-limits.yml, plans/tmdb-plans-pricing.yml)
- Daily export sample: https://files.tmdb.org/p/exports/movie_ids_09_09_2026.json.gz

Adjacent:
- OMDb: https://www.omdbapi.com/ , https://www.omdbapi.com/apikey.aspx , https://github.com/api-evangelist/omdb
- Wikidata: https://www.mediawiki.org/wiki/Wikidata_Query_Service/User_Manual , https://www.wikidata.org/wiki/Property:P4947
- Wikipedia: https://en.wikipedia.org/api/rest_v1/page/summary/Inception , https://www.mediawiki.org/wiki/Wikimedia_APIs/Rate_limits
- IMDb datasets: https://data.imdb.com/non-commercial-datasets/
- MovieLens: https://grouplens.org/datasets/movielens/ , https://grouplens.org/datasets/movielens/32m/
- TVmaze: https://www.tvmaze.com/api , https://www.tvmaze.com/premium
- TheTVDB: https://thetvdb.com/api-information , https://thetvdb.com/subscribe , https://github.com/thetvdb/v4-api , https://thetvdb.github.io/v4-api/
- Trakt: https://trakt.docs.apiary.io/ (blueprint: /api-description-document) , https://forums.trakt.tv/t/how-do-i-export-my-data/54762 , https://forums.trakt.tv/t/import-from-imdb-letterboxd-tv-time-csv-or-json-files/32483 , https://www.achriom.com/blog/how-to-export-your-trakt-data/
- Simkl: https://simkl.docs.apiary.io/ (blueprint: /api-description-document)
- Watchmode: https://api.watchmode.com/
- Streaming Availability: https://www.movieofthenight.com/about/api , /about/api/pricing , https://docs.movieofthenight.com/resource/shows , /resource/changes
- JustWatch: https://www.justwatch.com/us/JustWatch-Streaming-API , https://github.com/Electronic-Mango/simple-justwatch-python-api
- Kinocheck: https://api.kinocheck.com/
- YouTube: https://developers.google.com/youtube/v3/determine_quota_cost , https://developers.google.com/youtube/v3/revision_history
- Does The Dog Die: https://www.doesthedogdie.com/api , https://www.doesthedogdie.com/api/3.0
- Common Sense Media: https://www.commonsensemedia.org/developers
- RT/Metacritic scraping landscape: https://apify.com/fingolfin/rotten-tomatoes-scraper/api , https://apify.com/automation-lab/metacritic-scraper/api
- Letterboxd: https://letterboxd.com/about/importing-data/ (403 to bots) , https://github.com/Tetrax-10/letterboxd-csv-imdb-tmdb-mapper , https://gist.github.com/DenverCoder1/f218260e3f5cfc6551fab88e7b07d9f0
- TV Time: https://tvtrack.io/export-tv-time-data , https://hobiapp.com/blog/how-to-export-tv-time-data , https://www.achriom.com/blog/export-tv-time-data/ , https://github.com/Portvgal/tv-time-capsule
- Netflix: https://help.netflix.com/en/node/101917 , https://instantiator.dev/post/netflix-history/ , https://www.dataquest.io/blog/python-tutorial-analyze-personal-netflix-data/
- Prime Video: https://github.com/twocaretcat/watch-history-exporter-for-amazon-prime-video
