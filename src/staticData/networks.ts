/**
 * Networks, checked in — because TMDB cannot search them.
 *
 * `/search/company`, `/search/collection` and `/search/keyword` all exist.
 * **`/search/network` returns 404.** There is no network search at all; you
 * can only look one up by id. So typing "netflix" into a search box has never
 * been able to find the Netflix *network*, only shows with Netflix in the
 * title — which is why browsing by network was reachable in this app solely by
 * clicking a link on a series page that happened to be on one.
 *
 * A checked-in list fixes that and is instant: these live in the local index
 * alongside titles and people, so they are typo-tolerant and cost no request.
 *
 * Ids are harvested and verified against TMDB rather than guessed — the Indian
 * networks in particular were all wrong when guessed. Collected by walking the
 * most popular series in each of hi/ta/te/ml/mr/kn/bn and reading the
 * `networks` array off each one, then confirming each id resolves.
 */

export type NetworkEntry = { id: number; name: string };

/** Global streamers and broadcasters. */
export const GLOBAL_NETWORKS: NetworkEntry[] = [
  { id: 213, name: "Netflix" },
  { id: 1024, name: "Prime Video" },
  { id: 49, name: "HBO" },
  { id: 3186, name: "HBO Max" },
  { id: 2739, name: "Disney+" },
  { id: 2552, name: "Apple TV" },
  { id: 453, name: "Hulu" },
  { id: 3353, name: "Peacock" },
  { id: 4330, name: "Paramount+" },
  { id: 318, name: "STARZ" },
  { id: 1112, name: "Crunchyroll" },
  { id: 174, name: "AMC" },
  { id: 88, name: "FX" },
  { id: 47, name: "Comedy Central" },
  { id: 80, name: "Adult Swim" },
  { id: 13, name: "Nickelodeon" },
  { id: 64, name: "Discovery" },
  { id: 2076, name: "Paramount Network" },
  { id: 16, name: "CBS" },
  { id: 6, name: "NBC" },
  { id: 2, name: "ABC" },
  { id: 19, name: "FOX" },
  { id: 71, name: "The CW" },
  { id: 4, name: "BBC One" },
  { id: 332, name: "BBC Two" },
  { id: 1063, name: "Sky Atlantic" },
  { id: 247, name: "YouTube" },
];

/**
 * Indian networks, which is where the gap was widest.
 *
 * TMDB's own popularity ordering buries these, and without a search there was
 * no path to them at all — you could not get to Zee Marathi or SonyLIV from
 * anywhere in this app unless a series page happened to link it.
 */
export const INDIAN_NETWORKS: NetworkEntry[] = [
  { id: 2590, name: "ZEE5" },
  { id: 8036, name: "JioHotstar" },
  { id: 3919, name: "Disney+ Hotstar" },
  { id: 2646, name: "SonyLIV" },
  { id: 3758, name: "aha" },
  { id: 2964, name: "MX Player" },
  { id: 159, name: "StarPlus" },
  { id: 676, name: "Sony Entertainment Television" },
  { id: 1708, name: "Sony SAB" },
  { id: 524, name: "Colors" },
  { id: 526, name: "Zee TV" },
  { id: 3026, name: "Sun TV" },
  { id: 501, name: "STAR Vijay" },
  { id: 9040, name: "Zee Tamil" },
  { id: 2035, name: "STAR Maa" },
  { id: 2573, name: "Asianet" },
  { id: 2575, name: "Colors Kannada" },
  { id: 6989, name: "Zee Marathi" },
  { id: 2582, name: "Colors Marathi" },
  { id: 6816, name: "STAR Pravah" },
  { id: 4402, name: "STAR Jalsha" },
  { id: 7261, name: "Zee Bangla" },
  { id: 2584, name: "Colors Bangla" },
  { id: 9018, name: "Sun Bangla" },
];

export const NETWORKS: NetworkEntry[] = [...GLOBAL_NETWORKS, ...INDIAN_NETWORKS];
