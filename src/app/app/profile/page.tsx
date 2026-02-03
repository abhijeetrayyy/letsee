import { createClient } from "@/utils/supabase/server";
import SearchAndFilters from "@components/profile/SearchAndFilters";
import Link from "next/link";

/** Fetch public profiles with stats. Uses avatar_url if present (migration 011). */
async function getPublicProfiles() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { profiles: [], isAuthed: false };
  }

  const selectWithAvatar =
    "username, about, avatar_url, user_cout_stats (watched_count, favorites_count, watchlist_count)";
  const selectWithoutAvatar =
    "username, about, user_cout_stats (watched_count, favorites_count, watchlist_count)";

  let result = await supabase
    .from("users")
    .select(selectWithAvatar)
    .not("username", "is", null)
    .eq("visibility", "public")
    .order("updated_at", { ascending: false });

  if (result.error) {
    if (result.error.message?.includes("avatar_url") || result.error.code === "42703") {
      const fallback = await supabase
        .from("users")
        .select(selectWithoutAvatar)
        .not("username", "is", null)
        .eq("visibility", "public")
        .order("updated_at", { ascending: false });
      result = { data: fallback.data, error: fallback.error } as typeof result;
    }
  }

  if (result.error) {
    console.error("Error fetching profiles:", result.error);
    return { profiles: [], isAuthed: true };
  }

  const profiles = (result.data ?? []).map((p: Record<string, unknown>) => {
    const stats = (p.user_cout_stats as { watched_count?: number; favorites_count?: number; watchlist_count?: number }[])?.[0];
    return {
      username: String(p.username ?? ""),
      about: p.about != null ? String(p.about) : null,
      avatar_url: "avatar_url" in p && p.avatar_url != null ? String(p.avatar_url) : null,
      user_cout_stats: stats ?? null,
    };
  });

  return { profiles, isAuthed: true };
}

export default async function ProfileListPage() {
  const { profiles, isAuthed } = await getPublicProfiles();

  if (!isAuthed) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-200 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-neutral-700 bg-neutral-800/50 p-8 text-center">
          <h1 className="text-xl font-semibold text-white">Sign in to discover people</h1>
          <p className="mt-2 text-sm text-neutral-400">
            Log in to browse profiles and find your cinema soul.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-medium text-neutral-900 hover:bg-amber-400 transition-colors"
          >
            Log in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-neutral-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,80,40,0.06),transparent)] pointer-events-none" />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <header className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Discover people
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            Find your cinema soul — browse profiles and connect.
          </p>
        </header>
        <SearchAndFilters users={profiles} />
      </div>
    </div>
  );
}
