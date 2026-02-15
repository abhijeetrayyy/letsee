import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return jsonError("Not logged in", 401);
  }

  const showId = req.nextUrl.searchParams.get("showId");
  const season = req.nextUrl.searchParams.get("seasonNumber");
  const episode = req.nextUrl.searchParams.get("episodeNumber");

  if (!showId || !season || !episode) {
    return jsonError("Missing parameters", 400);
  }

  const { data, error } = await supabase
    .from("episode_ratings")
    .select("score, note")
    .eq("user_id", userData.user.id)
    .eq("show_id", showId)
    .eq("season_number", season)
    .eq("episode_number", episode)
    .maybeSingle();

  if (error) {
    console.error("Error fetching episode rating:", error);
    return jsonError("Failed to fetch", 500);
  }

  return jsonSuccess({
    score: data?.score ?? null,
    note: data?.note ?? "",
  });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return jsonError("Not logged in", 401);
  }

  const body = await req.json();
  const { showId, seasonNumber, episodeNumber, score, note } = body;

  if (!showId || seasonNumber === undefined || episodeNumber === undefined) {
    return jsonError("Missing parameters", 400);
  }

  // Fetch existing to support partial updates
  const { data: existing } = await supabase
    .from("episode_ratings")
    .select("score, note")
    .eq("user_id", userData.user.id)
    .eq("show_id", showId)
    .eq("season_number", seasonNumber)
    .eq("episode_number", episodeNumber)
    .maybeSingle();

  const newScore = score !== undefined ? score : existing?.score;
  const newNote = note !== undefined ? note : existing?.note;

  // Upsert
  const { error } = await supabase.from("episode_ratings").upsert(
    {
      user_id: userData.user.id,
      show_id: showId,
      season_number: seasonNumber,
      episode_number: episodeNumber,
      score: newScore,
      note: newNote,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "user_id,show_id,season_number,episode_number",
    },
  );

  if (error) {
    console.error("Error updating episode rating:", error);
    return jsonError("Failed to update", 500);
  }

  return jsonSuccess({ success: true });
}
