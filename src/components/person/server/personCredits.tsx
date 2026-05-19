"use client";

import MediaCard from "@/components/cards/MediaCard";
import SendMessageModal from "@components/message/sendCard";
import { useState } from "react";
import { GenreList } from "@/staticData/genreList";
import { Filter, X } from "lucide-react";

function PersonCredits({
  cast,
  crew,
  name,
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

  const sortedCast = cast?.slice().sort((a: any, b: any) => {
    const dateA = new Date(a.release_date || a.first_air_date || "1900-01-01").getTime();
    const dateB = new Date(b.release_date || b.first_air_date || "1900-01-01").getTime();
    return dateB - dateA;
  });

  const timelineData = sortedCast.reduce((acc: any, item: any) => {
    const year = new Date(item.release_date || item.first_air_date || "1900-01-01").getFullYear();
    if (!acc[year]) acc[year] = [];
    acc[year].push(item);
    return acc;
  }, {});

  const filteredCast = sortedCast.filter((item: any) => {
    const matchesMedia = mediaFilter === "all" || item.media_type === mediaFilter;
    const matchesRole = excludeTalkShow ? item.character !== "Talk Show Host" : true;
    return matchesMedia && matchesRole;
  });

  // Get unique departments from crew
  const departments = Array.from(new Set(crew.map((c: any) => c.department).filter(Boolean))).sort();

  const filteredCrew = crew.filter((item: any) => {
    return departmentFilter === "all" || item.department === departmentFilter;
  });

  const handleCardTransfer = (data: any) => {
    setCardData(data);
    setIsModalOpen(true);
  };

  const genresFromIds = (ids: number[] | undefined) =>
    (ids ?? []).map((id: number) => GenreList.genres.find((g: any) => g.id === id)?.name).filter(Boolean) as string[];

  const renderCard = (data: any, isCrew: boolean = false, index: number) => {
    const title = data.title || data.name || "Unknown";
    const year = data.release_date || data.first_air_date
      ? String(new Date(data.release_date || data.first_air_date || "1900-01-01").getFullYear())
      : null;
    const subtitle = isCrew
      ? `${name}: ${data.job} (${data.department})${data.release_date ? ` · ${data.release_date}` : ""}`
      : data.character ? `character — ${data.character}` : undefined;

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
      {filteredCrew.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-1 h-6 rounded-full bg-brand-500 shrink-0" />
            <div>
              <h3 className="text-lg font-bold text-white">Crew</h3>
              <p className="text-sm text-surface-500 mt-0.5">{filteredCrew.length} credits</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filteredCrew.map((item: any, index: number) => renderCard(item, true, index))}
          </div>
        </div>
      )}
    </div>
  );
}

export default PersonCredits;
