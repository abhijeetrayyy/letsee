"use client";

import MediaCard from "@/components/cards/MediaCard";
import SendMessageModal from "@components/message/sendCard";
import { useState } from "react";
import { GenreList } from "@/staticData/genreList";

function PersonCredits({
  cast,
  crew,
  name,
  knownFor: _knownFor,
}: {
  cast: any[];
  crew: any[];
  name: string;
  /** Pre-computed "Known For" list from person page; section is rendered there. */
  knownFor?: any[];
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cardData, setCardData] = useState<any>(null);
  const [mediaFilter, setMediaFilter] = useState<string>("all");
  const [excludeTalkShow, setExcludeTalkShow] = useState<boolean>(true);

  // Sort and group cast by year
  const sortedCast = cast?.slice().sort((a: any, b: any) => {
    const dateA = new Date(
      a.release_date || a.first_air_date || "1900-01-01"
    ).getTime();
    const dateB = new Date(
      b.release_date || b.first_air_date || "1900-01-01"
    ).getTime();
    return dateB - dateA;
  });

  // Group by year
  const timelineData = sortedCast.reduce((acc: any, item: any) => {
    const year = new Date(
      item.release_date || item.first_air_date || "1900-01-01"
    ).getFullYear();
    if (!acc[year]) acc[year] = [];
    acc[year].push(item);
    return acc;
  }, {});

  // Filter cast based on media type and role
  const filteredCast = sortedCast.filter((item: any) => {
    const matchesMedia =
      mediaFilter === "all" || item.media_type === mediaFilter;
    const matchesRole = excludeTalkShow
      ? item.character !== "Talk Show Host"
      : true;
    return matchesMedia && matchesRole;
  });

  const handleCardTransfer = (data: any) => {
    setCardData(data);
    setIsModalOpen(true);
  };

  const genresFromIds = (ids: number[] | undefined) =>
    (ids ?? [])
      .map((id: number) => GenreList.genres.find((g: any) => g.id === id)?.name)
      .filter(Boolean) as string[];

  const renderCard = (data: any, isCrew: boolean = false, index: number) => {
    const title = data.title || data.name || "Unknown";
    const year =
      data.release_date || data.first_air_date
        ? String(
            new Date(
              data.release_date || data.first_air_date || "1900-01-01"
            ).getFullYear()
          )
        : null;
    const subtitle = isCrew
      ? `${name}: ${data.job} (${data.department})${data.release_date ? ` · ${data.release_date}` : ""}`
      : data.character
      ? `character — ${data.character}`
      : undefined;

    return (
      <MediaCard
        key={index}
        id={data.id}
        title={title}
        mediaType={data.media_type === "tv" ? "tv" : "movie"}
        posterPath={data.poster_path || data.backdrop_path}
        adult={!!data.adult}
        genres={genresFromIds(data.genre_ids)}
        showActions={!isCrew}
        onShare={!isCrew ? () => handleCardTransfer(data) : undefined}
        typeLabel={isCrew ? "In Prod." : data.media_type}
        year={year}
        subtitle={subtitle}
        className="w-full max-w-[10rem] sm:max-w-[11rem]"
      />
    );
  };

  return (
    <div className="w-full py-6 text-white">
      <SendMessageModal
        media_type={cardData?.media_type}
        data={cardData}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      {/* Filters */}
      <div className="rounded-2xl border border-neutral-700/60 bg-neutral-800/40 p-4 sm:p-5 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Filter credits</h2>
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <select
            value={mediaFilter}
            onChange={(e) => setMediaFilter(e.target.value)}
            className="px-4 py-2 bg-neutral-700 rounded-xl text-white border border-neutral-600 w-full sm:w-auto focus:ring-2 focus:ring-amber-500/50 focus:outline-none"
          >
            <option value="all">All Media</option>
            <option value="movie">Movies</option>
            <option value="tv">TV Shows</option>
          </select>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={excludeTalkShow}
              onChange={(e) => setExcludeTalkShow(e.target.checked)}
              className="w-5 h-5"
            />
            <span className="text-sm">Exclude Talk Show Host</span>
          </label>
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-2xl border border-neutral-700/60 bg-neutral-800/30 p-4 sm:p-6">
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-6">Timeline</h2>
        {Object.keys(timelineData).length > 0 ? (
          <div className="space-y-8">
            {Object.entries(timelineData)
              .sort(([yearA], [yearB]) => Number(yearB) - Number(yearA))
              .map(([year, items]: [string, any], index: number) => (
                <div key={index} className="relative">
                  <div className="flex items-center mb-4">
                    <span className="text-lg font-semibold bg-amber-500/20 text-amber-200 px-4 py-2 rounded-full">
                      {year}
                    </span>
                    <div className="flex-1 h-px bg-neutral-700 ml-4"></div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {items
                      .filter(
                        (item: any) =>
                          (mediaFilter === "all" ||
                            item.media_type === mediaFilter) &&
                          (!excludeTalkShow ||
                            item.character !== "Talk Show Host")
                      )
                      .map((item: any, index: number) =>
                        renderCard(item, false, index)
                      )}
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <p className="text-center text-neutral-400">
            No acting credits available.
          </p>
        )}
      </div>

      {/* Crew Section */}
      {crew.length > 0 && (
        <div className="mt-8 rounded-2xl border border-neutral-700/60 bg-neutral-800/30 p-4 sm:p-6">
          <h3 className="text-xl font-semibold text-white mb-6">Crew</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {crew.map((item: any, index: number) =>
              renderCard(item, true, index)
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default PersonCredits;
