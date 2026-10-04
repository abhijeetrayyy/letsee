"use client";

import useSWR from "swr";
import Link from "@components/ui/AppLink";
import { MonitorPlay } from "lucide-react";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import { useCountry } from "@/app/contextAPI/countryContext";
import { supabase } from "@/utils/supabase/client";
import { getPosterUrl } from "@/utils/imageUrl";
import { titlePath } from "@/utils/urls";
import { useInView } from "@/hooks/useInView";

/**
 * "New on your services this week."
 *
 * A directed shelf, not a carousel: the viewer arrives holding a question —
 * what arrived on the services I actually pay for — and the answer comes from
 * the daily snapshot (099), diffed against the day each service was first
 * scanned so the seeding day is never "new". Nothing here is a recommendation;
 * it is a fact about the viewer's own subscriptions.
 *
 * Renders nothing until a person has named their services and the job has
 * run at least twice; the placeholder keeps the in-view sentinel alive.
 */

type Row = {
  item_id: string;
  item_type: "movie" | "tv";
  item_name: string | null;
  image_url: string | null;
  provider_name: string;
  provider_id: number;
  first_seen: string;
  popularity: number | null;
};

function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function NewOnYourServices() {
  const { user, ready } = useAuth();
  const userId = user?.id ?? null;
  const { ref, inView } = useInView<HTMLDivElement>();

  // The country context already resolves `users.watch_region` (and the
  // selector's override) once for the whole app; no second read of it here.
  const { country } = useCountry();
  const region = (country || "US").toUpperCase();

  const { data } = useSWR(userId && inView ? ["new-on-services", userId, region] : null, async () => {
    const { data: mine } = await supabase.from("user_providers").select("provider_id, provider_name").eq("user_id", userId as string);
    const providers = (mine ?? []).map((p) => Number(p.provider_id));
    if (!providers.length) return { items: [] as Row[], region };

    // Only pairs scanned before the week began can have something "new" in it.
    const { data: scans } = await supabase
      .from("catalog_scans")
      .select("provider_id, first_scan_on")
      .eq("region", region)
      .in("provider_id", providers)
      .lt("first_scan_on", daysAgo(7));
    const eligible = (scans ?? []).map((s) => Number(s.provider_id));
    if (!eligible.length) return { items: [] as Row[], region };

    const { data: rows } = await supabase
      .from("title_availability")
      .select("item_id, item_type, item_name, image_url, provider_name, provider_id, first_seen, popularity")
      .eq("region", region)
      .eq("kind", "flatrate")
      .in("provider_id", eligible)
      .gte("first_seen", daysAgo(7))
      .not("item_name", "is", null)
      .order("popularity", { ascending: false })
      .limit(24);

    // One card per title even if it arrived on two services.
    const seen = new Set<string>();
    const items = ((rows ?? []) as Row[]).filter((r) => {
      const k = `${r.item_type}:${r.item_id}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return { items: items.slice(0, 12), region };
  });

  if (!ready || !userId) return null;
  // A sentinel until it's in view; `-mb-px` and no height so the page's gap
  // isn't doubled around an empty section.
  if (!inView) return <div ref={ref} aria-hidden className="-my-7 h-px" />;
  if (!data || data.items.length === 0) return <div ref={ref} aria-hidden className="-my-7 h-px" />;

  return (
    <section ref={ref}>
      <div className="mb-4 flex items-center gap-2.5">
        <MonitorPlay className="size-5 text-accent" aria-hidden />
        <h2 className="text-2xl text-ink-0 sm:text-3xl">New on your services</h2>
      </div>
      <div className="no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {data.items.map((r) => (
          <Link
            key={`${r.item_type}:${r.item_id}`}
            href={titlePath(r.item_type, r.item_id, r.item_name)}
            className="group w-36 shrink-0 snap-start sm:w-44"
          >
            <div className="relative aspect-2/3 overflow-hidden rounded-media bg-raised ring-1 ring-inset ring-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getPosterUrl(r.image_url, "w342")}
                alt=""
                loading="lazy"
                className="img-fade h-full w-full object-cover transition-opacity group-hover:opacity-90"
              />
            </div>
            <p className="mt-2 truncate font-display text-base text-ink-0">{r.item_name}</p>
            <p className="truncate text-xs text-ink-500">{r.provider_name}</p>
          </Link>
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-600">Availability from JustWatch via TMDB.</p>
    </section>
  );
}
