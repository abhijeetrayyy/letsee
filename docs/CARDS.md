# Media cards – single source of truth

All movie/TV/person **tiles** (poster + title + optional actions) use the **centralized** `MediaCard` component:

- **Path:** `src/components/cards/MediaCard.tsx`
- **Rule:** Do not add custom card markup (poster + title + preference/share buttons) elsewhere. Map your data to MediaCard props (`id`, `title`, `mediaType`, `posterPath`/`imageUrl`, `genres`, `showActions`, `onShare`, etc.) and use this component only.

## Where MediaCard is used

| Location | Usage |
|----------|--------|
| `src/components/movie/homeContentTile.tsx` | Homepage trending rows |
| `src/components/movie/recoTiles.tsx` | Detail page "More like this" |
| `src/components/homeDiscover/client/seachForm.tsx` | Homepage search results |
| `src/app/app/search/[query]/page.tsx` | Search results page |
| `src/components/profile/profileWatched.tsx` | Profile watched list |
| `src/components/profile/ProfileFavorite.tsx` | Profile favorites |
| `src/components/profile/ProfileWatchlater.tsx` | Profile watchlist |
| `src/components/profile/ListDetail.tsx` | User list items |
| `src/components/profile/recomendation.tsx` | Profile recommendations (search grid, recently watched, showcase) |
| `src/components/person/server/personCredits.tsx` | Person page credits (cast/crew) |
| `src/components/person/KnowFor.tsx` | Person page "Known for" row |
| `src/app/app/tvbygenre/list/[id]/page.tsx` | TV by genre list |
| `src/components/clientComponent/moviebyGenre.tsx` | Movie by genre list |
| `src/components/clientComponent/weeklyTop.tsx` | Weekly top row |
| `src/components/clientComponent/topTv.tsx` | Top TV row |
| `src/components/ai/openaiReco.tsx` | AI recommendations grid |

## Not using MediaCard (by design)

- **Detail pages** (`movie.tsx`, `tv.tsx`): Use `ThreePrefrenceBtn` in "detail" variant for the main CTA pills (Watched / Favorites / Watchlist) – this is page-level UI, not a card.
- **Reel page** (`reelUi.tsx`): Single current movie with preference buttons below the video – one-item context, not a card grid.
- **Header search bar** (`searchBar.tsx`): Compact result rows (small thumb + title), not poster cards.
