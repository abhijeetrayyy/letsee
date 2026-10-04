"use client";

import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import useSWR from "swr";
import Link from "@components/ui/AppLink";
import TonightRoom from "@components/tonight/TonightRoom";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import { supabase } from "@/utils/supabase/client";
import { readWith } from "@/lib/people/tonight";
import { swrFetcher } from "@/utils/swrFetcher";

/** Whether you've told us your services — your own rows, read in the browser. */
async function hasProviders(me: string): Promise<boolean> {
  const { count } = await supabase.from("user_providers").select("provider_id", { count: "exact", head: true }).eq("user_id", me);
  return (count ?? 0) > 0;
}

function Inner() {
  const { user, ready } = useAuth();
  const me = user?.id ?? null;
  const pathname = usePathname();
  const params = useSearchParams();
  const wanted = readWith(params.get("with"));
  const { data: providers } = useSWR(me ? ["has-providers", me] : null, () => hasProviders(me!), { revalidateOnFocus: false });
  // `?club=slug`: decide with a group room's members.
  const clubSlug = params.get("club");
  const { data: clubData, error: clubError } = useSWR<{ club: { slug: string; name: string; join_policy?: string }; members: { userId: string; username: string; avatarUrl: string | null }[]; isMember: boolean }>(
    me && clubSlug ? `/api/clubs/${encodeURIComponent(clubSlug)}` : null,
    swrFetcher,
    { revalidateOnFocus: false },
  );
  const club = clubData?.club && clubData.isMember ? { slug: clubData.club.slug, name: clubData.club.name, admitted: clubData.club.join_policy === "request", members: clubData.members } : null;

  if (!ready || (me && providers === undefined) || (me && clubSlug && clubData === undefined && !clubError)) {
    return <div aria-hidden className="h-64 rounded-card bg-raised/40" />;
  }
  if (!me) {
    const next = `${pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    return (
      <div className="flex flex-col items-start gap-4 rounded-card border border-line-strong bg-raised/40 p-5">
        <p className="text-base text-ink-0">Sign in to decide together.</p>
        <p className="text-sm text-ink-400">Tonight works from what you&apos;ve saved, the services you have and the people you watch with, so it needs to know who you are.</p>
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="inline-flex h-11 items-center rounded-full bg-action px-5 text-base font-semibold text-on-action hover:bg-action-hover">
          Sign in
        </Link>
      </div>
    );
  }
  return <TonightRoom hasProviders={!!providers} prefill={wanted} club={club} me={me} />;
}

export default function TonightClient() {
  return (
    <Suspense fallback={<div aria-hidden className="h-64 rounded-card bg-raised/40" />}>
      <Inner />
    </Suspense>
  );
}
