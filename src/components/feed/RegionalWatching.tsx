"use client";

import useSWR from "swr";
import Link from "@components/ui/AppLink";
import { MapPin } from "lucide-react";
import { supabase } from "@/utils/supabase/client";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import { useCountry } from "@/app/contextAPI/countryContext";
import { getPosterUrl } from "@/utils/imageUrl";
import { titlePath } from "@/utils/urls";

/**
 * "Watched this week by people in India." Counts only, never names; nothing
 * under the floor `regional_watching` (102) enforces. The region is the
 * country context's, which is the account's `watch_region` when signed in.
 */
type Row = { item_id: string; item_type: string; item_name: string | null; image_url: string | null; viewers: number };

export default function RegionalWatching() {
  const { ready } = useAuth();
  // The country context resolves `users.watch_region` for signed-in people
  // and the stored selector choice for everyone else.
  const { country } = useCountry();
  const region = (country || "US").toUpperCase();
  const { data } = useSWR(ready ? ["regional-watching", region] : null, async () => {
    const { data: rows, error } = await supabase.rpc("regional_watching", {
      p_region: region,
      p_days: 7,
      p_floor: 3,
      p_limit: 12,
    });
    if (error) return { region, rows: [] as Row[] };
    return { region, rows: ((rows ?? []) as Row[]).filter((r) => r.item_name) };
  });

  if (!data || data.rows.length === 0) return null;

  let regionName = data.region;
  try {
    regionName = new Intl.DisplayNames(undefined, { type: "region" }).of(data.region) ?? data.region;
  } catch {
    // Fall back to the code.
  }

  return (
    <div className="rounded-xl border border-surface-800 bg-surface-900/40 p-4">
      <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-surface-500">
        <MapPin className="size-3.5" /> Watched this week, near you ({regionName})
      </p>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {data.rows.map((r) => (
          <Link key={`${r.item_type}:${r.item_id}`} href={titlePath(r.item_type, r.item_id, r.item_name)} className="w-24 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={getPosterUrl(r.image_url, "w185")} alt="" loading="lazy" className="aspect-[2/3] w-full rounded-lg object-cover" />
            <p className="mt-1.5 truncate text-xs text-surface-200">{r.item_name}</p>
            <p className="text-[11px] text-surface-500">{r.viewers} people</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
