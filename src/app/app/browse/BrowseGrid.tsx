"use client";

import MediaCard from "@components/cards/MediaCard";
import Pagination from "@components/buttons/searchByGenreBtn";

type Item = {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  overview?: string;
};

/**
 * The results grid.
 *
 * Reuses the same card and the same grid columns as search and the genre
 * lists, so browse doesn't read as a different product. `Pagination` already
 * preserves sibling query parameters, which is exactly what a facetted URL
 * needs — and is why D3 can add filters without touching it.
 */
export default function BrowseGrid({
  items,
  mediaType,
  page,
  totalPages,
}: {
  items: Item[];
  mediaType: "movie" | "tv";
  page: number;
  totalPages: number;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {items.map((item) => (
          <MediaCard
            key={item.id}
            id={item.id}
            title={item.title ?? item.name ?? ""}
            mediaType={mediaType}
            posterPath={item.poster_path}
            releaseDate={item.release_date ?? item.first_air_date ?? null}
            rating={item.vote_average ?? null}
            voteCount={item.vote_count ?? null}
            overview={item.overview ?? null}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-8">
          <Pagination currentPage={page} totalPages={totalPages} />
        </div>
      )}
    </>
  );
}
