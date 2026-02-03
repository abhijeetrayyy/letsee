import { createClient } from "@/utils/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }
  const { data, error } = await supabase
    .from("users")
    .select("visibility, profile_show_diary, profile_show_ratings, profile_show_public_reviews")
    .eq("id", user.id)
    .maybeSingle();
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
  if (!data) {
    return new Response(JSON.stringify({ error: "Profile not found" }), {
      status: 404,
    });
  }
  return new Response(
    JSON.stringify({
      visibility: data.visibility ?? "public",
      profile_show_diary: data.profile_show_diary ?? true,
      profile_show_ratings: data.profile_show_ratings ?? true,
      profile_show_public_reviews: data.profile_show_public_reviews ?? true,
    })
  );
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }
  let body: {
    visibility?: string;
    profile_show_diary?: boolean;
    profile_show_ratings?: boolean;
    profile_show_public_reviews?: boolean;
  } = {};
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
    });
  }
  const updates: Record<string, unknown> = {};
  if (typeof body.visibility === "string" && ["public", "followers", "private"].includes(body.visibility)) {
    updates.visibility = body.visibility;
  }
  if (typeof body.profile_show_diary === "boolean") updates.profile_show_diary = body.profile_show_diary;
  if (typeof body.profile_show_ratings === "boolean") updates.profile_show_ratings = body.profile_show_ratings;
  if (typeof body.profile_show_public_reviews === "boolean") updates.profile_show_public_reviews = body.profile_show_public_reviews;
  if (Object.keys(updates).length === 0) {
    return new Response(JSON.stringify({ error: "No valid fields to update" }), {
      status: 400,
    });
  }
  const { error: updateError } = await supabase
    .from("users")
    .update(updates)
    .eq("id", user.id);
  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), {
      status: 500,
    });
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
