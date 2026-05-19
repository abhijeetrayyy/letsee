import { createClient } from "@/utils/supabase/server";
import { serverFetchJson } from "@/utils/serverFetch";
import { MOODS, RUNTIME_OPTIONS, DECADE_OPTIONS } from "@/staticData/moodMapping";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const TMDB_BASE = "https://api.themoviedb.org/3";
const MAX_PICKS = 10;

type WhatToWatchParams = {
  mood?: string;
  genre?: string;
  runtime?: string;
  decade?: string;
  mediaType?: string;
};

function getDecadeFilter(decade: string): { gte?: string; lte?: string } {
  const opt = DECADE_OPTIONS.find((d) => d.value === decade);
  return opt ? { gte: opt.gte, lte: opt.lte } : {};
}

function getRuntimeFilter(runtime: string): { gte?: number; lte?: number } {
  const opt = RUNTIME_OPTIONS.find((r) => r.value === runtime);
  return opt ? { gte: opt.min, lte: opt.max } : {};
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const params: WhatToWatchParams = {
    mood: searchParams.get("mood") ?? undefined,
    genre: searchParams.get("genre") ?? undefined,
    runtime: searchParams.get("runtime") ?? undefined,
    decade: searchParams.get("decade") ?? undefined,
    mediaType: searchParams.get("mediaType") ?? "movie",
  };

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "TMDB_API_KEY missing" }, { status: 500 });
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;

  let consumedIds = new Set<string>();
  if (userId) {
    const [watchedRes, favRes] = await Promise.all([
      supabase.from("watched_items").select("item_id, item_type").eq("user_id", userId),
      supabase.from("favorite_items").select("item_id, item_type").eq("user_id", userId),
    ]);
    for (const item of [...(watchedRes.data ?? []), ...(favRes.data ?? [])]) {
      consumedIds.add(`${item.item_type}:${item.item_id}`);
    }
  }

  const moodInfo = params.mood ? MOODS[params.mood] : null;
  const genreId = params.genre ? parseInt(params.genre) : null;
  const runtimeFilter = params.runtime ? getRuntimeFilter(params.runtime) : {};
  const decadeFilter = params.decade ? getDecadeFilter(params.decade) : {};

  const mediaTypes = params.mediaType === "both" ? ["movie", "tv"] : [params.mediaType || "movie"];

  const allPicks: any[] = [];

  for (const mediaType of mediaTypes) {
    const endpoint = mediaType === "movie" ? "discover/movie" : "discover/tv";
    const paramsObj = new URLSearchParams({
      api_key: apiKey,
      language: "en-US",
      sort_by: "vote_average.desc",
      "vote_count.gte": "50",
      page: "1",
    });

    let genres: number[] = [];
    if (moodInfo) genres.push(...moodInfo.genres);
    if (genreId) genres.push(genreId);
    if (genres.length > 0) {
      paramsObj.set("with_genres", [...new Set(genres)].join(","));
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
      const results = (data.results ?? []).filter((item: any) => {
        const key = `${mediaType}:${item.id}`;
        return !consumedIds.has(key);
      });
      allPicks.push(...results.map((r: any) => ({ ...r, _mediaType: mediaType })));
    } catch {
      // skip failed endpoint
    }
  }

  const shuffled = shuffleArray(allPicks);
  const picks = shuffled.slice(0, MAX_PICKS).map((item: any) => ({
    id: String(item.id),
    title: item.title ?? item.name ?? "Unknown",
    mediaType: item._mediaType ?? "movie",
    posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
    year: (item.release_date ?? item.first_air_date ?? "").substring(0, 4),
    overview: item.overview ?? "",
    voteAverage: item.vote_average ?? 0,
    genreIds: item.genre_ids ?? [],
  }));

  return NextResponse.json({
    params: {
      mood: moodInfo ? { label: moodInfo.label, icon: moodInfo.icon } : null,
      genre: genreId,
      runtime: params.runtime ?? null,
      decade: params.decade ?? null,
      mediaType: params.mediaType ?? "movie",
    },
    picks,
    total: picks.length,
  });
}
