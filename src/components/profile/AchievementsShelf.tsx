"use client";

import useSWR from "swr";
import { swrFetcher } from "@/utils/swrFetcher";

type Achievement = {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  unlockedAt: string;
};

export default function AchievementsShelf({ userId }: { userId: string }) {
  const { data } = useSWR<{ achievements: Achievement[] }>(
    `/api/profile/achievements?userId=${encodeURIComponent(userId)}`,
    swrFetcher,
  );
  const achievements = data?.achievements ?? [];

  if (achievements.length === 0) return null;

  return (
    <div className="rounded-xl border border-surface-700/60 bg-surface-900/40 p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-1 h-5 rounded-full bg-accent-gold" />
        <h2 className="text-base font-bold text-white">Badges</h2>
        <span className="text-xs text-surface-500">{achievements.length}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {achievements.map((a) => (
          <div
            key={a.id}
            title={a.description}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-800/60 border border-surface-700/50 text-sm"
          >
            <span className="text-base leading-none">{a.icon}</span>
            <span className="text-surface-200 font-medium">{a.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
