import { createClient } from "@/utils/supabase/server";
import { FRANCHISES, type Franchise, type FranchiseEntry } from "@/staticData/franchises";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type FranchiseProgress = {
  franchiseId: string;
  name: string;
  total: number;
  completed: number;
  percentage: number;
  nextUp: FranchiseEntry | null;
  entries: (FranchiseEntry & { watched: boolean })[];
};

export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const [watchedRes, favRes] = await Promise.all([
      supabase.from("watched_items").select("item_id, item_name, item_type").eq("user_id", userId),
      supabase.from("favorite_items").select("item_id, item_name, item_type").eq("user_id", userId),
    ]);

    const consumedIds = new Set<string>();
    for (const item of [...(watchedRes.data ?? []), ...(favRes.data ?? [])]) {
      consumedIds.add(`${item.item_type}:${item.item_id}`);
    }

    const progress: FranchiseProgress[] = FRANCHISES.map((franchise: Franchise) => {
      const entries = franchise.entries.map((entry) => {
        const key = `${entry.type}:${entry.tmdbId}`;
        return { ...entry, watched: consumedIds.has(key) };
      });

      const completed = entries.filter((e) => e.watched).length;
      const total = entries.length;

      const nextUp = entries.find((e) => !e.watched) ?? null;

      return {
        franchiseId: franchise.id,
        name: franchise.name,
        total,
        completed,
        percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
        nextUp,
        entries,
      };
    }).filter((f) => f.completed > 0 || f.total > 0);

    progress.sort((a, b) => b.percentage - a.percentage);

    return NextResponse.json({ franchises: progress });
  } catch (err) {
    console.error("Franchise progress error:", err);
    return NextResponse.json({ error: "Failed to load franchise data" }, { status: 500 });
  }
}
