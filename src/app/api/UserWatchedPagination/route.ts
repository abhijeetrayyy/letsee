import { createClient } from "@/utils/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { userID, page, genre } = await request.json();

  if (!userID) {
    return new Response(JSON.stringify({ error: "User ID is required" }), {
      status: 400,
    });
  }

  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();
  const viewerId = viewer?.id ?? null;

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("visibility")
    .eq("id", userID)
    .maybeSingle();

  if (profileError || !profile) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
    });
  }

  const visibility = profile.visibility ?? "public";
  let canView = visibility === "public" || (viewerId && viewerId === userID);

  if (!canView && viewerId && visibility === "followers") {
    const { data: connection } = await supabase
      .from("user_connections")
      .select("id")
      .eq("follower_id", viewerId)
      .eq("followed_id", userID)
      .maybeSingle();
    if (connection) {
      canView = true;
    }
  }

  if (!canView) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
    });
  }

  const safePage = Number(page) || 1;

  // Initialize the query
  let query = supabase
    .from("watched_items")
    .select("*", { count: "exact" }) // Fetch total count
    .eq("user_id", userID)
    .order("watched_at", { ascending: false }); // Sort by newest first

  // Apply genre filter if provided
  if (genre) {
    query = query.contains("genres", [genre]); // Filter by genre
  }

  // Apply pagination
  const itemsPerPage = 50;
  query = query.range(
    (safePage - 1) * itemsPerPage,
    safePage * itemsPerPage - 1
  );

  // Execute the query
  const { data, error, count } = await query;

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }

  // Calculate total items and pages
  const totalItems = count || 0; // Use the count returned by Supabase
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  return new Response(
    JSON.stringify({
      data,
      totalItems,
      totalPages,
    })
  );
}
