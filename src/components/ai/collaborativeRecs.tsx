"use client";
import { useState } from "react";
import MediaCard from "@components/cards/MediaCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Users } from "lucide-react";

interface CollabRecommendation {
  itemId: string;
  itemType: string;
  name: string;
  imageUrl: string | null;
  avgScore: number;
  userCount: number;
}

interface CollabResponse {
  recommendations: CollabRecommendation[];
  sourceUsers?: { userId: string; similarity: number }[];
  note?: string;
  error?: string;
}

export default function CollaborativeRecs() {
  const [recommendations, setRecommendations] = useState<CollabRecommendation[]>([]);
  const [sourceUsers, setSourceUsers] = useState<{ userId: string; similarity: number }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const fetchRecommendations = async () => {
    setIsLoading(true);
    setError(null);
    setNote(null);
    try {
      const response = await fetch("/api/recommendations/collaborative");
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to fetch recommendations");
      }
      const data: CollabResponse = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      setRecommendations(data.recommendations ?? []);
      setSourceUsers(data.sourceUsers ?? []);
      if (data.note) setNote(data.note);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <button
          onClick={fetchRecommendations}
          disabled={isLoading}
          className="px-6 py-2.5 bg-accent-purple text-white font-semibold rounded-full hover:bg-accent-purple/80 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[200px] transition-all duration-200 active:scale-[0.98]"
        >
          {isLoading ? (
            <>
              <LoadingSpinner size="sm" className="border-t-white shrink-0" />
              <span>Finding similar tastes…</span>
            </>
          ) : (
            <>
              <Users className="w-4 h-4" />
              People Like You Also Like
            </>
          )}
        </button>
        {sourceUsers.length > 0 && (
          <span className="text-xs text-surface-500">
            Based on {sourceUsers.length} similar viewer{sourceUsers.length > 1 ? "s" : ""}
            {sourceUsers[0] && ` (${sourceUsers[0].similarity}% match)`}
          </span>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 text-red-300 text-sm">
          {error}
        </div>
      )}

      {note && !error && (
        <div className="p-4 rounded-xl bg-surface-800/40 border border-surface-700/60 text-surface-400 text-sm">
          {note}
        </div>
      )}

      {recommendations.length > 0 && (
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
            {recommendations.map((rec) => (
              <div key={`${rec.itemType}:${rec.itemId}`} className="relative">
                <MediaCard
                  id={Number(rec.itemId)}
                  title={rec.name}
                  mediaType={rec.itemType as "movie" | "tv"}
                  imageUrl={rec.imageUrl}
                  adult={false}
                  genres={[]}
                  showActions={true}
                  typeLabel={rec.itemType}
                />
                <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm rounded-full px-2 py-0.5 text-xs font-semibold text-accent-gold">
                  {rec.avgScore}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
