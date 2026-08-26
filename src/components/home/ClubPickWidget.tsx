"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "@components/ui/AppLink";
import { Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { fetchCurrentClubPick } from "@/lib/db/home";
import { getPosterUrl } from "@/utils/imageUrl";
import Comments from "@components/social/Comments";

import { titlePath } from "@/utils/urls";
export default function ClubPickWidget() {
  const [expanded, setExpanded] = useState(false);
  // Straight to `club_picks`, which is world-readable — the route in front of
  // it was a Vercel function forwarding one `select` on the home page of every
  // visitor, signed in or not.
  const { data: pick } = useSWR("club-pick:current", fetchCurrentClubPick);

  if (!pick) return null;

  return (
    <div className="rounded-xl border border-surface-800/50 bg-surface-900/30 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="size-3.5 text-accent-gold" />
        <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider">This Week’s Club Pick</h3>
      </div>
      <div className="flex gap-3">
        <Link href={titlePath(pick.item_type, pick.item_id, pick.title)} className="shrink-0 w-16 aspect-[2/3] rounded-lg overflow-hidden bg-surface-800">
          <img loading="lazy" decoding="async" src={getPosterUrl(pick.image_url)} alt={pick.title} className="w-full h-full object-cover" />
        </Link>
        <div className="flex-1 min-w-0">
          <Link href={titlePath(pick.item_type, pick.item_id, pick.title)} className="text-sm font-semibold text-white hover:text-brand-400 transition-colors line-clamp-1">
            {pick.title}
          </Link>
          {pick.note && <p className="text-xs text-surface-500 mt-1 line-clamp-2">{pick.note}</p>}
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 mt-2 transition-colors"
          >
            {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            {expanded ? "Hide discussion" : "Join the discussion"}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="mt-4 pt-4 border-t border-surface-800/60">
          <Comments itemId={String(pick.id)} itemType="club_pick" />
        </div>
      )}
    </div>
  );
}
