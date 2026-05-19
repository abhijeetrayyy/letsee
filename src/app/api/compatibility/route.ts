import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type GenreVector = Record<string, number>;

function normalize(v: GenreVector): GenreVector {
  const mag = Math.sqrt(Object.values(v).reduce((s, x) => s + x * x, 0));
  if (mag === 0) return v;
  const out: GenreVector = {};
  for (const key of Object.keys(v)) out[key] = v[key] / mag;
  return out;
}

function cosineSimilarity(a: GenreVector, b: GenreVector): number {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dot = 0;
  for (const k of keys) dot += (a[k] ?? 0) * (b[k] ?? 0);
  return dot;
}

function buildVector(items: { genres?: string[] | null }[]): GenreVector {
  const v: GenreVector = {};
  for (const item of items) {
    if (Array.isArray(item.genres)) {
      for (const g of item.genres) v[g] = (v[g] ?? 0) + 1;
    }
  }
  return normalize(v);
}

function ratingCorrelation(
  userRatings: Map<string, number>,
  otherRatings: Map<string, number>,
): number {
  const shared: { u: number; o: number }[] = [];
  for (const [key, score] of userRatings) {
    const other = otherRatings.get(key);
    if (other !== undefined) shared.push({ u: score, o: other });
  }

  if (shared.length < 3) return 0;

  const meanU = shared.reduce((s, x) => s + x.u, 0) / shared.length;
  const meanO = shared.reduce((s, x) => s + x.o, 0) / shared.length;

  let num = 0, denU = 0, denO = 0;
  for (const { u, o } of shared) {
    const du = u - meanU;
    const dO = o - meanO;
    num += du * dO;
    denU += du * du;
    denO += dO * dO;
  }

  const den = Math.sqrt(denU) * Math.sqrt(denO);
  return den === 0 ? 0 : num / den;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const otherUserId = searchParams.get("userId");
  if (!otherUserId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const currentUserId = auth?.user?.id;

  if (!currentUserId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const [myWatched, myFavs, myRatings, otherWatched, otherFavs, otherRatings] = await Promise.all([
      supabase.from("watched_items").select("genres").eq("user_id", currentUserId),
      supabase.from("favorite_items").select("genres").eq("user_id", currentUserId),
      supabase.from("user_ratings").select("item_id, item_type, score").eq("user_id", currentUserId),
      supabase.from("watched_items").select("genres").eq("user_id", otherUserId),
      supabase.from("favorite_items").select("genres").eq("user_id", otherUserId),
      supabase.from("user_ratings").select("item_id, item_type, score").eq("user_id", otherUserId),
    ]);

    const myVector = buildVector([...(myWatched.data ?? []), ...(myFavs.data ?? [])]);
    const otherVector = buildVector([...(otherWatched.data ?? []), ...(otherFavs.data ?? [])]);

    const genreSim = cosineSimilarity(myVector, otherVector);

    const myRatingMap = new Map((myRatings.data ?? []).map((r) => [`${r.item_type}:${r.item_id}`, r.score]));
    const otherRatingMap = new Map((otherRatings.data ?? []).map((r) => [`${r.item_type}:${r.item_id}`, r.score]));
    const ratingSim = ratingCorrelation(myRatingMap, otherRatingMap);

    const combined = Math.round(((genreSim * 0.6 + Math.max(0, ratingSim) * 0.4)) * 100);

    const sharedItems = [...myRatingMap.keys()].filter((k) => otherRatingMap.has(k));
    const genreMatchLevel = genreSim > 0.5 ? "high" : genreSim > 0.2 ? "medium" : "low";

    return NextResponse.json({
      compatibility: Math.min(100, Math.max(0, combined)),
      genreSimilarity: Math.round(genreSim * 100),
      ratingCorrelation: Math.round(ratingSim * 100),
      sharedRatings: sharedItems.length,
      genreMatchLevel,
      breakdown: {
        genreWeight: 60,
        ratingWeight: 40,
      },
    });
  } catch (err) {
    console.error("Compatibility error:", err);
    return NextResponse.json({ error: "Failed to compute compatibility" }, { status: 500 });
  }
}
