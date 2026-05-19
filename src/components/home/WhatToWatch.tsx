"use client";

import { useState } from "react";
import MediaCard from "@components/cards/MediaCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { MOODS, RUNTIME_OPTIONS, DECADE_OPTIONS, MEDIA_TYPE_OPTIONS } from "@/staticData/moodMapping";
import { Shuffle, Sparkles } from "lucide-react";

type PickItem = {
  id: string;
  title: string;
  mediaType: string;
  posterUrl: string | null;
  year: string;
  overview: string;
  voteAverage: number;
  genreIds: number[];
};

type PickerParams = {
  mood: { label: string; icon: string } | null;
  genre: number | null;
  runtime: string | null;
  decade: string | null;
  mediaType: string;
};

type PickerResult = {
  params: PickerParams;
  picks: PickItem[];
  total: number;
};

export default function WhatToWatch() {
  const [selectedMood, setSelectedMood] = useState<string>("");
  const [selectedRuntime, setSelectedRuntime] = useState<string>("");
  const [selectedDecade, setSelectedDecade] = useState<string>("");
  const [selectedMediaType, setSelectedMediaType] = useState<string>("movie");
  const [result, setResult] = useState<PickerResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(true);

  const handlePick = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    const params = new URLSearchParams();
    if (selectedMood) params.set("mood", selectedMood);
    if (selectedRuntime) params.set("runtime", selectedRuntime);
    if (selectedDecade) params.set("decade", selectedDecade);
    params.set("mediaType", selectedMediaType);

    try {
      const res = await fetch(`/api/what-to-watch?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to get picks");
      const data: PickerResult = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-surface-700/60 bg-surface-900/40 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-surface-100">
            What should I watch?
          </h3>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="text-xs text-surface-400 hover:text-surface-200"
          >
            {showFilters ? "Hide filters" : "Show filters"}
          </button>
        </div>

        {showFilters && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-surface-400 uppercase tracking-wider mb-2 block">
                Mood
              </label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(MOODS).map(([key, mood]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedMood(selectedMood === key ? "" : key)}
                    className={`px-3 py-2 rounded-full text-xs font-medium border transition-all ${
                      selectedMood === key
                        ? "bg-brand-500/20 border-brand-500/50 text-brand-300"
                        : "bg-surface-800/60 border-surface-700/50 text-surface-300 hover:border-surface-600"
                    }`}
                  >
                    {mood.icon} {mood.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-surface-400 uppercase tracking-wider mb-2 block">
                  Type
                </label>
                <div className="flex gap-2">
                  {MEDIA_TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setSelectedMediaType(opt.value)}
                      className={`px-3 py-2 rounded-full text-xs font-medium border transition-all ${
                        selectedMediaType === opt.value
                          ? "bg-brand-500/20 border-brand-500/50 text-brand-300"
                          : "bg-surface-800/60 border-surface-700/50 text-surface-300 hover:border-surface-600"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-surface-400 uppercase tracking-wider mb-2 block">
                  Runtime
                </label>
                <select
                  value={selectedRuntime}
                  onChange={(e) => setSelectedRuntime(e.target.value)}
                  className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-200 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                >
                  <option value="">Any</option>
                  {RUNTIME_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-surface-400 uppercase tracking-wider mb-2 block">
                  Era
                </label>
                <select
                  value={selectedDecade}
                  onChange={(e) => setSelectedDecade(e.target.value)}
                  className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-200 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                >
                  <option value="">Any</option>
                  {DECADE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-center">
          <button
            onClick={handlePick}
            disabled={loading}
            className="px-8 py-3 bg-brand-500 text-surface-950 font-semibold rounded-full hover:bg-brand-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" className="border-t-surface-950" />
                <span>Finding something good...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Pick for Me
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-800/40 bg-red-900/20 p-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-sm text-surface-400">
            <Shuffle className="w-4 h-4 text-brand-400" />
            <span>
              {result.params.mood && (
                <span className="text-surface-200">
                  {result.params.mood.icon} {result.params.mood.label}
                  {" \u00B7 "}
                </span>
              )}
              Found <span className="text-white font-semibold">{result.total}</span> picks
              {result.params.runtime && ` \u00B7 ${RUNTIME_OPTIONS.find(r => r.value === result.params.runtime)?.label}`}
              {result.params.decade && ` \u00B7 ${DECADE_OPTIONS.find(d => d.value === result.params.decade)?.label}`}
            </span>
          </div>

          {result.picks.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
              {result.picks.map((pick) => (
                <div key={`${pick.mediaType}:${pick.id}`} className="relative">
                  <MediaCard
                    id={Number(pick.id)}
                    title={pick.title}
                    mediaType={pick.mediaType as "movie" | "tv"}
                    imageUrl={pick.posterUrl}
                    adult={false}
                    genres={[]}
                    showActions={true}
                    typeLabel={pick.mediaType}
                  />
                  {pick.voteAverage > 0 && (
                    <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm rounded-full px-2 py-0.5 text-xs font-semibold text-accent-gold">
                      {pick.voteAverage.toFixed(1)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-surface-700/60 bg-surface-900/40 p-8 text-center">
              <p className="text-surface-400 text-sm">No picks found. Try different filters.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
