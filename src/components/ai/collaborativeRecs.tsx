"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import MediaCard from "@components/cards/MediaCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Users, RefreshCw, Sparkles, User } from "lucide-react";

interface CollabRecommendation {
  itemId: string;
  itemType: string;
  name: string;
  imageUrl: string | null;
  avgScore: number;
  userCount: number;
  recentUserCount: number;
  matchTags: string[];
  isRecent: boolean;
}

interface SimilarUser {
  similarity: number;
  avatarUrl: string | null;
  displayName: string | null;
  topGenres: string[];
  matchedItemCount: number;
}

interface CollabResponse {
  recommendations: CollabRecommendation[];
  similarUsers?: SimilarUser[];
  userTopGenres?: string[];
  note?: string;
  error?: string;
}

function SkeletonGrid({ count = 5 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-2 animate-pulse">
          <div className="aspect-[2/3] bg-surface-800 rounded-xl" />
          <div className="h-3 bg-surface-800 rounded w-3/4" />
          <div className="h-2 bg-surface-800 rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}

export default function CollaborativeRecs() {
  const [recommendations, setRecommendations] = useState<CollabRecommendation[]>([]);
  const [similarUsers, setSimilarUsers] = useState<SimilarUser[]>([]);
  const [userTopGenres, setUserTopGenres] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const sectionRef = useRef<HTMLDivElement>(null);

  const fetchRecommendations = useCallback(async () => {
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
      if (data.error) throw new Error(data.error);
      setRecommendations(data.recommendations ?? []);
      setSimilarUsers(data.similarUsers ?? []);
      setUserTopGenres(data.userTopGenres ?? []);
      if (data.note) setNote(data.note);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  return (
    <div ref={sectionRef} className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-accent-purple shrink-0" />
            <h3 className="text-base font-semibold text-surface-100">People Like You Also Like</h3>
          </div>
          {userTopGenres.length > 0 && (
            <p className="text-xs text-surface-500 mt-0.5">
              Based on your taste in <span className="text-surface-300">{userTopGenres.join(", ")}</span>
            </p>
          )}
        </div>
        <button
          onClick={fetchRecommendations}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-surface-800 hover:bg-surface-700 text-surface-300 rounded-lg border border-surface-700/50 transition-all disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Similar Users Row */}
      {similarUsers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {similarUsers.slice(0, 6).map((u, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-3 py-1.5 bg-surface-800/40 rounded-full border border-surface-700/40 text-xs"
              title={`${u.displayName ?? "User"} — ${u.similarity}% match${u.topGenres.length > 0 ? ` • ${u.topGenres.join(", ")}` : ""}`}
            >
              {u.avatarUrl ? (
                <img src={u.avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <User className="w-4 h-4 text-surface-500" />
              )}
              <span className="text-surface-300 font-medium">{u.similarity}%</span>
              {u.topGenres.length > 0 && (
                <span className="text-surface-500 hidden sm:inline">{u.topGenres[0]}</span>
              )}
            </div>
          ))}
          {similarUsers.length > 6 && (
            <span className="text-xs text-surface-500 self-center">+{similarUsers.length - 6} more</span>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 text-red-300 text-sm">{error}</div>
      )}

      {/* Note (empty state) */}
      {note && !error && (
        <div className="p-4 rounded-xl bg-surface-800/40 border border-surface-700/60 text-surface-400 text-sm">{note}</div>
      )}

      {/* Loading skeleton */}
      {isLoading && <SkeletonGrid count={5} />}

      {/* Results */}
      {recommendations.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {recommendations.map((rec, idx) => (
            <div
              key={`${rec.itemType}:${rec.itemId}`}
              className="relative animate-in fade-in slide-in-from-bottom-2"
              style={{ animationDuration: "400ms", animationDelay: `${idx * 60}ms`, animationFillMode: "both" }}
            >
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

              {/* Match badges */}
              <div className="absolute top-0 left-0 right-0 flex justify-between p-1.5 pointer-events-none">
                {rec.matchTags.length > 0 && (
                  <div className="flex gap-1">
                    {rec.matchTags.map((tag) => (
                      <span
                        key={tag}
                        className="px-1.5 py-0.5 text-[9px] font-medium bg-accent-purple/80 backdrop-blur-sm rounded-md text-white leading-tight"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-accent-gold ml-auto">
                  <Sparkles className="w-2.5 h-2.5" />
                  {rec.avgScore}
                </div>
              </div>

              {/* User count footer */}
              <div className="mt-1 flex items-center justify-between px-0.5">
                <div className="flex items-center gap-1 text-[10px] text-surface-500">
                  <Users className="w-3 h-3" />
                  {rec.userCount}
                </div>
                {rec.isRecent && (
                  <span className="text-[9px] text-green-400 font-medium">Recent</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
