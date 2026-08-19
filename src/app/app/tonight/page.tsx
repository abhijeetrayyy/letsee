import Link from "next/link";
import { Film } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import TonightRoom from "@components/tonight/TonightRoom";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Tonight",
  description: "Two people, one evening, the services you actually have. We'll decide.",
};

/**
 * Resolved server-side so the room never flashes the service picker at someone
 * who has already set theirs.
 */
async function hasProviders(userId: string): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { count } = await supabase
      .from("user_providers")
      .select("provider_id", { count: "exact", head: true })
      .eq("user_id", userId);
    return (count ?? 0) > 0;
  } catch {
    // A missing table (migration not yet applied) shouldn't 500 the page —
    // the picker is the right fallback, and saving it will surface the error.
    return false;
  }
}

export default async function TonightPage() {
  const userId = await getAuthUserId();

  return (
    <div className="w-full bg-surface-950 min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <header className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">Tonight</h1>
          <p className="mt-2 text-surface-400">
            Who&apos;s watching, how long you&apos;ve got, and we&apos;ll pick.
          </p>
        </header>

        {userId ? (
          <TonightRoom hasProviders={await hasProviders(userId)} />
        ) : (
          <div className="rounded-2xl border border-surface-800 bg-surface-900/60 p-8 text-center">
            <Film className="size-8 text-brand-400 mx-auto mb-3" />
            <h2 className="text-white font-semibold">Sign in to decide together</h2>
            <p className="text-surface-400 text-sm mt-2 max-w-sm mx-auto">
              Tonight works from your watchlist, your services, and the people you follow — so it
              needs to know who you are.
            </p>
            <Link href="/login" className="btn-primary text-sm px-5 py-2.5 mt-5 inline-flex">
              Sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
