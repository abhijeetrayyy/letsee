"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import MediaCard from "@components/cards/MediaCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { MOODS, RUNTIME_OPTIONS, DECADE_OPTIONS, MEDIA_TYPE_OPTIONS } from "@/staticData/moodMapping";
import {
  Sparkles, Shuffle, Zap, Clock, Film, Tv, ThumbsUp, ThumbsDown,
  RotateCw, ChevronRight, ChevronLeft, X, Dices, Star,
} from "lucide-react";

type PickItem = {
  id: string;
  title: string;
  mediaType: string;
  posterUrl: string | null;
  year: string;
  overview: string;
  voteAverage: number;
  genreIds: number[];
  reason: string;
};

type PickerResult = {
  params: {
    moods: { label: string; icon: string }[];
    runtime: string | null;
    decade: string | null;
    mediaType: string;
    isSurprise: boolean;
  };
  picks: PickItem[];
  total: number;
  sessionId: string;
};

type Step = "mood" | "refine" | "results";

const QUICK_PRESETS = [
  { id: "date-night", label: "Date Night", icon: "\u{1F496}", moods: ["romantic", "funny"] },
  { id: "brain-off", label: "Brain Off", icon: "\u{1F634}", moods: ["funny", "action-packed"] },
  { id: "family-time", label: "Family Time", icon: "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}", moods: ["feel-good", "chill"] },
  { id: "deep-thinker", label: "Deep Thinker", icon: "\u{1F9E0}", moods: ["thoughtful", "mind-bending"] },
  { id: "scare-night", label: "Scare Night", icon: "\u{1F47B}", moods: ["scary", "thrilling"] },
];

const SESSION_KEY = "wtww_seen";

function getSessionSeen(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

function addSessionSeen(ids: string[]) {
  try {
    const existing = getSessionSeen();
    for (const id of ids) existing.add(id);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify([...existing]));
  } catch { /* ignore */ }
}

function getMoodGradient(key: string): string {
  const gradients: Record<string, string> = {
    "feel-good": "from-amber-400/30 via-yellow-500/20 to-orange-600/30",
    "thrilling": "from-red-600/30 via-orange-500/20 to-rose-700/30",
    "scary": "from-purple-900/40 via-indigo-800/30 to-gray-900/40",
    "romantic": "from-pink-400/30 via-rose-500/20 to-red-600/30",
    "thoughtful": "from-blue-600/30 via-indigo-500/20 to-teal-700/30",
    "funny": "from-green-400/30 via-lime-500/20 to-emerald-600/30",
    "action-packed": "from-red-500/30 via-orange-400/20 to-yellow-600/30",
    "chill": "from-cyan-400/30 via-teal-500/20 to-blue-600/30",
    "mind-bending": "from-violet-600/30 via-purple-500/20 to-fuchsia-700/30",
    "nostalgic": "from-amber-500/30 via-yellow-400/20 to-orange-500/30",
  };
  return gradients[key] ?? "from-surface-700/40 to-surface-800/40";
}

export default function WhatToWatch() {
  const [step, setStep] = useState<Step>("mood");
  const [selectedMoods, setSelectedMoods] = useState<Set<string>>(new Set());
  const [selectedRuntime, setSelectedRuntime] = useState<string>("");
  const [selectedDecade, setSelectedDecade] = useState<string>("");
  const [selectedMediaType, setSelectedMediaType] = useState<string>("movie");
  const [result, setResult] = useState<PickerResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [animateIn, setAnimateIn] = useState(false);
  const [feedback, setFeedback] = useState<Record<string, "up" | "down">>({});
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (result) {
      const seen = getSessionSeen();
      addSessionSeen(result.picks.map((p) => p.id));
      setTimeout(() => {
        setAnimateIn(true);
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    }
  }, [result]);

  const handlePick = useCallback(async (isSurprise = false) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setAnimateIn(false);
    setFeedback({});

    const params = new URLSearchParams();
    if (!isSurprise && selectedMoods.size > 0) {
      params.set("moods", [...selectedMoods].join(","));
    }
    if (selectedRuntime) params.set("runtime", selectedRuntime);
    if (selectedDecade) params.set("decade", selectedDecade);
    params.set("mediaType", selectedMediaType);
    if (isSurprise) params.set("surprise", "true");
    if (isSurprise) setStep("results");

    // Send session exclude list
    const seen = getSessionSeen();
    if (seen.size > 0) params.set("exclude", [...seen].join(","));

    try {
      const res = await fetch(`/api/what-to-watch?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to get picks");
      const data: PickerResult = await res.json();
      setResult(data);
      setStep("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [selectedMoods, selectedRuntime, selectedDecade, selectedMediaType]);

  const handlePreset = useCallback((preset: typeof QUICK_PRESETS[0]) => {
    setSelectedMoods(new Set(preset.moods));
    setSelectedRuntime("");
    setSelectedDecade("");
    setSelectedMediaType("movie");
    setStep("refine");
  }, []);

  const reset = useCallback(() => {
    setStep("mood");
    setSelectedMoods(new Set());
    setSelectedRuntime("");
    setSelectedDecade("");
    setSelectedMediaType("movie");
    setResult(null);
    setError(null);
    setAnimateIn(false);
    setFeedback({});
  }, []);

  const toggleMood = (key: string) => {
    const next = new Set(selectedMoods);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedMoods(next);
  };

  const retry = () => handlePick(result?.params.isSurprise ?? false);

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="flex items-center gap-2 text-xs font-medium">
        {(["mood", "refine", "results"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
              step === s
                ? "bg-brand-500 text-surface-950 scale-110"
                : ["mood", "refine"].includes(step)
                  ? "bg-surface-700 text-surface-300"
                  : "bg-surface-800 text-surface-500"
            }`}>
              {i + 1}
            </div>
            <span className={`hidden sm:inline capitalize ${step === s ? "text-surface-200" : "text-surface-500"}`}>
              {s === "mood" ? "Mood" : s === "refine" ? "Refine" : "Results"}
            </span>
            {i < 2 && <ChevronRight className="w-3 h-3 text-surface-600" />}
          </div>
        ))}
      </div>

      {/* Quick Presets Bar */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        <button
          onClick={() => handlePick(true)}
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-500/20 to-accent-purple/20 border border-brand-500/30 text-brand-300 text-sm font-medium whitespace-nowrap hover:from-brand-500/30 hover:to-accent-purple/30 transition-all shrink-0"
        >
          <Dices className="w-4 h-4" />
          Surprise Me
        </button>
        {QUICK_PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => handlePreset(p)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-surface-800/60 border border-surface-700/50 text-surface-300 text-sm whitespace-nowrap hover:bg-surface-700/60 hover:border-surface-600 transition-all shrink-0"
          >
            <span>{p.icon}</span>
            {p.label}
          </button>
        ))}
      </div>

      {/* Main Card */}
      <div className="rounded-2xl border border-surface-700/60 bg-surface-900/40 p-5 sm:p-6">
        {/* Step 1: Mood */}
        {step === "mood" && (
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-semibold text-surface-100 mb-1">How do you want to feel?</h3>
              <p className="text-sm text-surface-500">Pick one or more moods</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {Object.entries(MOODS).map(([key, mood]) => {
                const active = selectedMoods.has(key);
                return (
                  <button
                    key={key}
                    onClick={() => toggleMood(key)}
                    className={`relative group overflow-hidden rounded-xl border p-4 text-left transition-all duration-200 ${
                      active
                        ? "border-brand-500/60 bg-brand-500/10 shadow-lg shadow-brand-500/5"
                        : "border-surface-700/50 bg-surface-800/40 hover:border-surface-600 hover:bg-surface-800/60"
                    }`}
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${getMoodGradient(key)} opacity-30 group-hover:opacity-40 transition-opacity`} />
                    <div className="relative">
                      <div className="text-2xl mb-2">{mood.icon}</div>
                      <div className="text-sm font-medium text-surface-200">{mood.label}</div>
                      <div className="text-[10px] text-surface-500 mt-0.5 leading-tight">{mood.description}</div>
                    </div>
                    {active && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center">
                        <svg className="w-3 h-3 text-surface-950" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setStep("refine")}
                className="px-6 py-2.5 bg-brand-500 text-surface-950 font-semibold rounded-full hover:bg-brand-400 transition-all flex items-center gap-2"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Refine */}
        {step === "refine" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-surface-100 mb-1">Fine-tune your pick</h3>
                <p className="text-sm text-surface-500">
                  {selectedMoods.size > 0 && (
                    <>{[...selectedMoods].map((k) => MOODS[k].icon).join(" ")} {[...selectedMoods].map((k) => MOODS[k].label).join(", ")}</>
                  )}
                </p>
              </div>
              <button onClick={() => setStep("mood")} className="text-xs text-brand-400 hover:underline">
                Change mood
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="flex items-center gap-1.5 text-xs text-surface-400 uppercase tracking-wider mb-2.5">
                  <Film className="w-3 h-3" /> Type
                </label>
                <div className="flex gap-2">
                  {MEDIA_TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setSelectedMediaType(opt.value)}
                      className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-medium border transition-all ${
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
                <label className="flex items-center gap-1.5 text-xs text-surface-400 uppercase tracking-wider mb-2.5">
                  <Clock className="w-3 h-3" /> Runtime
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {RUNTIME_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setSelectedRuntime(selectedRuntime === opt.value ? "" : opt.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        selectedRuntime === opt.value
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
                <label className="flex items-center gap-1.5 text-xs text-surface-400 uppercase tracking-wider mb-2.5">
                  <Star className="w-3 h-3" /> Era
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {DECADE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setSelectedDecade(selectedDecade === opt.value ? "" : opt.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        selectedDecade === opt.value
                          ? "bg-brand-500/20 border-brand-500/50 text-brand-300"
                          : "bg-surface-800/60 border-surface-700/50 text-surface-300 hover:border-surface-600"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep("mood")} className="text-sm text-surface-400 hover:text-surface-200 flex items-center gap-1">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={() => handlePick(false)}
                disabled={loading}
                className="px-8 py-2.5 bg-brand-500 text-surface-950 font-semibold rounded-full hover:bg-brand-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
              >
                {loading ? (
                  <>
                    <LoadingSpinner size="sm" className="border-t-surface-950" />
                    <span>Finding picks...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Show Me
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Results */}
        {step === "results" && (
          <div className="space-y-4">
            {loading ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-sm text-surface-400">
                  <LoadingSpinner size="sm" className="border-t-white shrink-0" />
                  Curating your picks...
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="aspect-[2/3] bg-surface-800 rounded-xl" />
                      <div className="h-3 bg-surface-800 rounded mt-2 w-3/4" />
                      <div className="h-2 bg-surface-800 rounded mt-1 w-1/2" />
                    </div>
                  ))}
                </div>
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <div className="rounded-xl bg-red-500/5 border border-red-500/20 p-4 inline-block">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
                <div className="mt-4 flex gap-3 justify-center">
                  <button onClick={retry} className="px-5 py-2 bg-brand-500 text-surface-950 font-semibold rounded-full hover:bg-brand-400 text-sm">
                    Try again
                  </button>
                  <button onClick={reset} className="px-5 py-2 bg-surface-800 text-surface-300 font-medium rounded-full hover:bg-surface-700 text-sm">
                    Start over
                  </button>
                </div>
              </div>
            ) : result && result.picks.length > 0 ? (
              <>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-sm text-surface-400">
                    {result.params.isSurprise ? (
                      <><Dices className="w-4 h-4 text-accent-purple" /> Surprise picks</>
                    ) : (
                      <>
                        {result.params.moods.map((m, i) => (
                          <span key={i} className="text-surface-200 text-sm">{m.icon} {m.label}</span>
                        ))}
                        <span className="text-surface-600">|</span>
                        <span>{result.total} found</span>
                      </>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={retry}
                      disabled={loading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-800/60 border border-surface-700/50 text-xs text-surface-300 hover:bg-surface-700/60 transition-all"
                    >
                      <RotateCw className="w-3 h-3" /> Re-roll
                    </button>
                    <button
                      onClick={reset}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-800/60 border border-surface-700/50 text-xs text-surface-300 hover:bg-surface-700/60 transition-all"
                    >
                      <X className="w-3 h-3" /> New pick
                    </button>
                  </div>
                </div>

                <div ref={resultsRef} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {result.picks.map((pick, index) => (
                    <div
                      key={`${pick.mediaType}:${pick.id}`}
                      className={`relative transition-all duration-500 ${
                        animateIn
                          ? "opacity-100 translate-y-0"
                          : "opacity-0 translate-y-6"
                      }`}
                      style={{ transitionDelay: `${index * 80}ms` }}
                    >
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

                      {/* Match reason badge */}
                      <div className={`absolute top-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-medium backdrop-blur-sm ${
                        pick.reason.includes("taste")
                          ? "bg-brand-500/80 text-white"
                          : pick.reason.includes("acclaimed")
                            ? "bg-accent-gold/80 text-black"
                            : "bg-surface-800/80 text-surface-200"
                      }`}>
                        {pick.reason}
                      </div>

                      {/* Rating badge */}
                      {pick.voteAverage > 0 && (
                        <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm rounded-full px-2 py-0.5 text-xs font-semibold text-accent-gold">
                          {pick.voteAverage.toFixed(1)}
                        </div>
                      )}

                      {/* Feedback buttons */}
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            setFeedback((f) => ({ ...f, [pick.id]: f[pick.id] === "up" ? undefined as any : "up" }));
                          }}
                          className={`p-1.5 rounded-full backdrop-blur-sm transition-all ${
                            feedback[pick.id] === "up"
                              ? "bg-green-500/80 text-white scale-110"
                              : "bg-black/50 text-surface-300 hover:bg-black/70"
                          }`}
                        >
                          <ThumbsUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            setFeedback((f) => ({ ...f, [pick.id]: f[pick.id] === "down" ? undefined as any : "down" }));
                          }}
                          className={`p-1.5 rounded-full backdrop-blur-sm transition-all ${
                            feedback[pick.id] === "down"
                              ? "bg-red-500/80 text-white scale-110"
                              : "bg-black/50 text-surface-300 hover:bg-black/70"
                          }`}
                        >
                          <ThumbsDown className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-center text-xs text-surface-600 pt-2">
                  {result.params.runtime && <>{RUNTIME_OPTIONS.find((r) => r.value === result.params.runtime)?.label} \u00B7 </>}
                  {result.params.decade && <>{DECADE_OPTIONS.find((d) => d.value === result.params.decade)?.label} \u00B7 </>}
                  Picks won't repeat this session
                </p>
              </>
            ) : result && result.picks.length === 0 ? (
              <div className="text-center py-10">
                <div className="text-4xl mb-3">{"\u{1F50D}"}</div>
                <p className="text-surface-400 text-sm mb-4">No picks found with those filters.</p>
                <div className="flex gap-3 justify-center">
                  <button onClick={retry} className="px-5 py-2 bg-surface-800 text-surface-300 font-medium rounded-full hover:bg-surface-700 text-sm">
                    Try again
                  </button>
                  <button onClick={reset} className="px-5 py-2 bg-brand-500 text-surface-950 font-semibold rounded-full hover:bg-brand-400 text-sm">
                    Start over
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
