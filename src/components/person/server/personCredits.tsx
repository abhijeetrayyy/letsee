"use client";

import MediaCard from "@/components/cards/MediaCard";
import SendMessageModal from "@components/message/sendCard";
import { useState } from "react";
import { GenreList } from "@/staticData/genreList";
import { Filter, X } from "lucide-react";

function PersonCredits({
  cast,
  crew,
  name: _name,
  knownFor: _knownFor,
}: {
  cast: any[];
  crew: any[];
  name: string;
  knownFor?: any[];
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cardData, setCardData] = useState<any>(null);
  const [mediaFilter, setMediaFilter] = useState<string>("all");
  const [excludeTalkShow, setExcludeTalkShow] = useState<boolean>(true);
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  // ISO dates sort correctly as strings, and skipping Date() avoids the
  // UTC-midnight shift that can bucket a 1 January title into the year before.
  const dateOf = (item: any): string => item.release_date || item.first_air_date || "";

  const sortedCast = cast?.slice().sort((a: any, b: any) => dateOf(b).localeCompare(dateOf(a)));

  const timelineData = sortedCast.reduce((acc: any, item: any) => {
    const year = dateOf(item).slice(0, 4) || "Unknown";
    if (!acc[year]) acc[year] = [];
    acc[year].push(item);
    return acc;
  }, {});

  // Get unique departments from crew
  const departments = Array.from(new Set(crew.map((c: any) => c.department).filter(Boolean))).sort();

  const filteredCrew = crew.filter((item: any) => {
    return departmentFilter === "all" || item.department === departmentFilter;
  });

  // TMDB returns one row per job, so a film someone directed, wrote and
  // produced arrived as three identical-looking cards. One card per title,
  // naming every job on it.
  const groupedCrew = (() => {
    const byTitle = new Map<string, any>();
    for (const item of filteredCrew) {
      const key = `${item.media_type}-${item.id}`;
      const seen = byTitle.get(key);
      if (seen) {
        if (item.job && !seen.jobs.includes(item.job)) seen.jobs.push(item.job);
      } else {
        byTitle.set(key, { ...item, jobs: item.job ? [item.job] : [] });
      }
    }
    return Array.from(byTitle.values()).sort((a, b) => dateOf(b).localeCompare(dateOf(a)));
  })();

  const handleCardTransfer = (data: any) => {
    setCardData(data);
    setIsModalOpen(true);
  };

  const genresFromIds = (ids: number[] | undefined) =>
    (ids ?? []).map((id: number) => GenreList.genres.find((g: any) => g.id === id)?.name).filter(Boolean) as string[];

  const renderCard = (data: any, isCrew: boolean = false, index: number) => {
    const title = data.title || data.name || "Unknown";
    // The person's name and the department were repeated on every card —
    // you are already on their page, and "Director (Directing)" says one
    // thing twice. The job is what you came to read, so that is all it says.
    const role = isCrew
      ? (data.jobs?.length ? data.jobs.join(", ") : data.job) || null
      : data.character
        ? `as ${data.character}`
        : null;

    return (
      <MediaCard
        key={index}
        id={data.id}
        title={title}
        mediaType={data.media_type === "tv" ? "tv" : "movie"}
        posterPath={data.poster_path || data.backdrop_path}
        adult={!!data.adult}
        genres={genresFromIds(data.genre_ids)}
        // Crew cards had no buttons at all, so a film you found by browsing a
        // director could not be added to a list without opening it first.
        showActions
        onShare={() => handleCardTransfer(data)}
        typeLabel={data.media_type}
        releaseDate={dateOf(data) || null}
        role={role}
        rating={typeof data.vote_average === "number" && data.vote_average > 0 ? data.vote_average : null}
        voteCount={data.vote_count}
        overview={data.overview}
        originalTitle={data.original_title || data.original_name}
        className="w-full max-w-[10rem] sm:max-w-[11rem]"
      />
    );
  };

  const activeFiltersCount = [mediaFilter !== "all", excludeTalkShow, departmentFilter !== "all"].filter(Boolean).length;

  return (
    <div className="w-full py-6 text-white">
      <SendMessageModal media_type={cardData?.media_type} data={cardData} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

      {/* Filter Toggle */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 rounded-full bg-brand-500 shrink-0" />
          <div>
            <h2 className="text-xl font-bold text-white">Filmography</h2>
            <p className="text-sm text-surface-500 mt-0.5">{cast.length} acting · {crew.length} crew</p>
          </div>
        </div>
        <button onClick={() => setShowFilters(!showFilters)} className="btn-secondary text-sm">
          <Filter className="w-4 h-4" />
          Filters
          {activeFiltersCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-brand-500/20 text-brand-400 text-xs">{activeFiltersCount}</span>
          )}
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="glass-card rounded-2xl p-4 mb-6 animate-fade-up">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Filter credits</h3>
            <button onClick={() => { setMediaFilter("all"); setExcludeTalkShow(true); setDepartmentFilter("all"); }} className="text-xs text-surface-400 hover:text-white transition-colors">
              Reset all
            </button>
          </div>
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="text-xs text-surface-500 mb-1 block">Media type</label>
              <select value={mediaFilter} onChange={(e) => setMediaFilter(e.target.value)} className="text-sm bg-surface-800 text-surface-300 rounded-lg px-3 py-2 border border-white/10 focus:border-brand-500 outline-none">
                <option value="all">All Media</option>
                <option value="movie">Movies</option>
                <option value="tv">TV Shows</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-surface-500 mb-1 block">Department</label>
              <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} className="text-sm bg-surface-800 text-surface-300 rounded-lg px-3 py-2 border border-white/10 focus:border-brand-500 outline-none">
                <option value="all">All Departments</option>
                {departments.map((d: string) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={excludeTalkShow} onChange={(e) => setExcludeTalkShow(e.target.checked)} className="w-4 h-4 rounded border-surface-600 bg-surface-700 text-brand-500 focus:ring-brand-500" />
                <span className="text-sm text-surface-300">Exclude Talk Show</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="space-y-8">
        {Object.keys(timelineData).length > 0 ? (
          Object.entries(timelineData)
            .sort(([yearA], [yearB]) => Number(yearB) - Number(yearA))
            .map(([year, items]: [string, any]) => {
              const filteredItems = items.filter((item: any) =>
                (mediaFilter === "all" || item.media_type === mediaFilter) &&
                (!excludeTalkShow || item.character !== "Talk Show Host")
              );
              if (filteredItems.length === 0) return null;

              return (
                <div key={year} className="relative">
                  <div className="flex items-center mb-4">
                    <span className="text-lg font-bold text-white bg-surface-800 px-4 py-2 rounded-xl border border-white/10">
                      {year}
                    </span>
                    <div className="flex-1 h-px bg-white/5 ml-4" />
                    <span className="text-xs text-surface-600 ml-3">{filteredItems.length} title{filteredItems.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {filteredItems.map((item: any, index: number) => renderCard(item, false, index))}
                  </div>
                </div>
              );
            })
        ) : (
          <div className="text-center py-12">
            <p className="text-surface-400 text-lg font-medium">No acting credits match your filters</p>
          </div>
        )}
      </div>

      {/* Crew Section */}
      {groupedCrew.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-1 h-6 rounded-full bg-brand-500 shrink-0" />
            <div>
              <h3 className="text-lg font-bold text-white">Crew</h3>
              <p className="text-sm text-surface-500 mt-0.5">
                {groupedCrew.length} title{groupedCrew.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {groupedCrew.map((item: any, index: number) => renderCard(item, true, index))}
          </div>
        </div>
      )}
    </div>
  );
}

export default PersonCredits;
