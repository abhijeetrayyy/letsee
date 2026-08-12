"use client";

import Link from "next/link";
import useSWR from "swr";
import { Users } from "lucide-react";
import Avatar from "@components/ui/Avatar";
import { swrFetcher } from "@/utils/swrFetcher";

type AudienceMember = { userId: string; username: string; avatarUrl: string | null };
type Audience = { viewers: number; totalUsers: number; sample: AudienceMember[] };

/**
 * "You're not the only one here who's seen this."
 *
 * The cheapest social signal in the product — it asks nothing of the reader.
 * When the number is small it's framed as a find rather than a statistic,
 * because on a small community a rare overlap is the interesting part.
 */
export default function TitleAudience({
  itemId,
  itemType,
}: {
  itemId: string | number;
  itemType: "movie" | "tv";
}) {
  const { data } = useSWR<Audience>(
    `/api/title-audience?itemId=${encodeURIComponent(String(itemId))}&itemType=${itemType}`,
    swrFetcher,
  );

  if (!data || data.viewers === 0) return null;

  const { viewers, totalUsers, sample } = data;
  const rare = totalUsers > 0 && (viewers <= 3 || viewers / totalUsers <= 0.15);

  const line = rare
    ? viewers === 1
      ? "Just one other person here has seen this."
      : `Only ${viewers} other people here have seen this.`
    : `${viewers} people here have seen this.`;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-surface-700/50 bg-surface-900/40 px-4 py-3">
      {sample.length > 0 ? (
        <div className="flex -space-x-2">
          {sample.slice(0, 4).map((m) => (
            <Link key={m.userId} href={`/app/profile/${m.username}`} title={`@${m.username}`}>
              <Avatar
                src={m.avatarUrl}
                name={m.username}
                size="sm"
                className="ring-2 ring-surface-900 transition-transform hover:scale-110"
              />
            </Link>
          ))}
        </div>
      ) : (
        <Users className="size-4 shrink-0 text-surface-500" />
      )}
      <p className="text-sm text-surface-300">
        {line}
        {rare && (
          <span className="ml-1 text-surface-500">That&apos;s a good sign.</span>
        )}
      </p>
    </div>
  );
}
