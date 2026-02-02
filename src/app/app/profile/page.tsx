// app/users/page.tsx
import { createClient } from "@/utils/supabase/server";
import SearchAndFilters from "@components/profile/SearchAndFilters";
import Link from "next/link";

const getUserData = async () => {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { Users: [], isAuthed: false };
  }

  const { data: Users, error } = await supabase
    .from("users")
    .select(
      `username,
      about,
      user_cout_stats (
        watched_count,
        favorites_count,
        watchlist_count
      )
    `
    )
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Error fetching users:", error);
    return { Users: [], isAuthed: true };
  }

  return { Users, isAuthed: true };
};

const Page = async () => {
  const { Users, isAuthed } = await getUserData();

  if (!isAuthed) {
    return (
      <div className="max-w-4xl w-full mx-auto p-6 text-neutral-200">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-6 text-center">
          <h1 className="text-2xl font-semibold">Sign in to view users</h1>
          <p className="mt-2 text-sm text-neutral-400">
            This section is available to logged-in users.
          </p>
          <Link
            href="/login"
            className="mt-4 inline-block rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500"
          >
            Log in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl w-full mx-auto p-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-neutral-300">Users</h1>
        <p className="text-neutral-500">Find Your Cinema Soul</p>
      </div>

      {/* Pass users data to the Client Component */}
      <SearchAndFilters users={Users} />
    </div>
  );
};

export default Page;
