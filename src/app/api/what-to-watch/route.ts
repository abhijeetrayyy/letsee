import { createClient } from "@/utils/supabase/server";
import { serverFetchJson } from "@/utils/serverFetch";
import { MOODS, RUNTIME_OPTIONS, DECADE_OPTIONS } from "@/staticData/moodMapping";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const TMDB_BASE = "https://api.themoviedb.org/3";
const MAX_PICKS = 12;
const SURPRISE_GENRES = [28, 12, 35, 18, 14, 27, 878, 53, 10749, 9648];

type WhatToWatchParams = {
  moods?: string[];
  genre?: string;
  runtime?: string;
  decade?: string;
  mediaType?: string;
  surprise?: string;
  excludeIds?: string;
};

function getDecadeFilter(decade: string): { gte?: string; lte?: string } {
  const opt = DECADE_OPTIONS.find((d) => d.value === decade);
  return opt ? { gte: opt.gte, lte: opt.lte } : {};
}

function getRuntimeFilter(runtime: string): { gte?: number; lte?: number } {
  const opt = RUNTIME_OPTIONS.find((r) => r.value === runtime);
  return opt ? { gte: opt.min, lte: opt.max } : {};
}

function buildGenreVector(items: { genres?: string[] | null }[]): Record<string, number> {
  const v: Record<string, number> = {};
  for (const item of items) {
    if (Array.isArray(item.genres)) {
      for (const g of item.genres) v[g] = (v[g] ?? 0) + 1;
    }
  }
  const mag = Math.sqrt(Object.values(v).reduce((s, x) => s + x * x, 0));
  if (mag > 0) for (const k of Object.keys(v)) v[k] /= mag;
  return v;
}

function pickReason(item: any, genreVector: Record<string, number>): string {
  const genreNames = (item.genre_ids as number[] ?? []).map(String);
  const matched = genreNames.filter((g) => genreVector[g]);
  if (matched.length > 0) {
    const best = matched.sort((a, b) => (genreVector[b] ?? 0) - (genreVector[a] ?? 0))[0];
    return `Matches your taste`;
  }
  if (item.vote_average >= 7.5) return "Critically acclaimed";
  if (item.vote_average >= 6) return "Well-received";
  return "Popular pick";
}

function smartScore(item: any, genreVector: Record<string, number>, genreNames: Set<string>): number {
  const itemGenres = new Set((item.genre_ids as number[] ?? []).map(String));
  let tasteScore = 0;
  let matched = 0;
  for (const g of itemGenres) {
    if (genreVector[g]) {
      tasteScore += genreVector[g];
      matched++;
    }
  }
  const tasteAvg = matched > 0 ? tasteScore / matched : 0;
  const genreOverlap = genreNames.size > 0 ? [...itemGenres].filter((g) => genreNames.has(g)).length / genreNames.size : 0;
  const quality = Math.min(1, (item.vote_average ?? 0) / 10);
  return tasteAvg * 0.4 + genreOverlap * 0.3 + quality * 0.3;
}

function weightedShuffle<T>(items: T[], scores: number[]): T[] {
  const indexed = items.map((item, i) => ({ item, weight: Math.max(0.1, scores[i] ?? 0.5) }));
  const totalWeight = indexed.reduce((s, x) => s + x.weight, 0);
  const result: T[] = [];
  const remaining = [...indexed];
  while (remaining.length > 0) {
    const r = Math.random() * remaining.reduce((s, x) => s + x.weight, 0);
    let cum = 0;
    let chosen = 0;
    for (let i = 0; i < remaining.length; i++) {
      cum += remaining[i].weight;
      if (r <= cum) { chosen = i; break; }
    }
    result.push(remaining[chosen].item);
    remaining.splice(chosen, 1);
  }
  return result;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const params: WhatToWatchParams = {
    moods: searchParams.get("moods")?.split(",").filter(Boolean),
    genre: searchParams.get("genre") ?? undefined,
    runtime: searchParams.get("runtime") ?? undefined,
    decade: searchParams.get("decade") ?? undefined,
    mediaType: searchParams.get("mediaType") ?? "movie",
    surprise: searchParams.get("surprise") ?? undefined,
    excludeIds: searchParams.get("exclude") ?? undefined,
  };

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "TMDB_API_KEY missing" }, { status: 500 });
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;

  let consumedIds = new Set<string>();
  let genreVector: Record<string, number> = {};
  let userGenreNames = new Set<string>();

  if (userId) {
    const [watchedRes, favRes] = await Promise.all([
      supabase.from("watched_items").select("item_id, item_type, genres").eq("user_id", userId),
      supabase.from("favorite_items").select("item_id, item_type, genres").eq("user_id", userId),
    ]);
    for (const item of [...(watchedRes.data ?? []), ...(favRes.data ?? [])]) {
      consumedIds.add(`${item.item_type}:${item.item_id}`);
    }
    genreVector = buildGenreVector([...(watchedRes.data ?? []), ...(favRes.data ?? [])]);
    for (const item of [...(watchedRes.data ?? []), ...(favRes.data ?? [])]) {
      if (Array.isArray(item.genres)) item.genres.forEach((g: string) => userGenreNames.add(g));
    }
  }

  // Exclude IDs from client session
  if (params.excludeIds) {
    for (const eid of params.excludeIds.split(",")) {
      consumedIds.add(`movie:${eid}`);
      consumedIds.add(`tv:${eid}`);
    }
  }

  const isSurprise = params.surprise === "true";
  const moodList = params.moods?.map((m) => MOODS[m]).filter(Boolean) ?? [];
  const runtimeFilter = params.runtime ? getRuntimeFilter(params.runtime) : {};
  const decadeFilter = params.decade ? getDecadeFilter(params.decade) : {};

  const mediaTypes = params.mediaType === "both" ? ["movie", "tv"] : [params.mediaType || "movie"];
  const allPicks: any[] = [];
  const allScores: number[] = [];

  for (const mediaType of mediaTypes) {
    const endpoint = mediaType === "movie" ? "discover/movie" : "discover/tv";
    const paramsObj = new URLSearchParams({
      api_key: apiKey,
      language: "en-US",
      "vote_count.gte": "50",
      page: "1",
    });

    if (isSurprise) {
      // Surprise mode: random genre from popular set
      const randomGenre = SURPRISE_GENRES[Math.floor(Math.random() * SURPRISE_GENRES.length)];
      paramsObj.set("sort_by", "vote_average.desc");
      paramsObj.set("with_genres", String(randomGenre));
    } else {
      let genres: number[] = [];
      for (const mood of moodList) genres.push(...mood.genres);
      if (genres.length > 0) paramsObj.set("with_genres", [...new Set(genres)].join(","));
      paramsObj.set("sort_by", "popularity.desc");
    }

    if (mediaType === "movie") {
      if (decadeFilter.gte) paramsObj.set("primary_release_date.gte", decadeFilter.gte);
      if (decadeFilter.lte) paramsObj.set("primary_release_date.lte", decadeFilter.lte);
      if (runtimeFilter.gte) paramsObj.set("with_runtime.gte", String(runtimeFilter.gte));
      if (runtimeFilter.lte) paramsObj.set("with_runtime.lte", String(runtimeFilter.lte));
    } else {
      if (decadeFilter.gte) paramsObj.set("first_air_date.gte", decadeFilter.gte);
      if (decadeFilter.lte) paramsObj.set("first_air_date.lte", decadeFilter.lte);
    }

    const url = `${TMDB_BASE}/${endpoint}?${paramsObj.toString()}`;

    try {
      const data = await serverFetchJson<{ results?: any[] }>(url);
      for (const item of (data.results ?? [])) {
        const key = `${mediaType}:${item.id}`;
        if (!consumedIds.has(key)) {
          allPicks.push({ ...item, _mediaType: mediaType });
        }
      }
    } catch {
      // skip failed endpoint
    }
  }

  for (const item of allPicks) {
    const score = isSurprise
      ? Math.random()
      : smartScore(item, genreVector, userGenreNames);
    allScores.push(score);
  }

  const ordered = weightedShuffle(allPicks, allScores);
  const picks = ordered.slice(0, MAX_PICKS).map((item: any) => ({
    id: String(item.id),
    title: item.title ?? item.name ?? "Unknown",
    mediaType: item._mediaType ?? "movie",
    posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
    year: (item.release_date ?? item.first_air_date ?? "").substring(0, 4),
    overview: item.overview ?? "",
    voteAverage: item.vote_average ?? 0,
    genreIds: item.genre_ids ?? [],
    reason: pickReason(item, genreVector),
  }));

  return NextResponse.json({
    params: {
      moods: moodList.map((m) => ({ label: m.label, icon: m.icon })),
      runtime: params.runtime ?? null,
      decade: params.decade ?? null,
      mediaType: params.mediaType ?? "movie",
      isSurprise,
    },
    picks,
    total: picks.length,
    sessionId: Date.now().toString(36),
  });
}
