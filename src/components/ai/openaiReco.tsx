"use client";
import { useState } from "react";
import MediaCard from "@components/cards/MediaCard";
import SendMessageModal from "@components/message/sendCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Sparkles } from "lucide-react";

interface MovieRecommendation {
  name: string;
  poster_url: string | null;
  id: string;
  genres: string[] | unknown;
}

export default function Recommendations() {
  const [recommendations, setRecommendations] = useState<MovieRecommendation[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cardData, setCardData] = useState<any>(null);

  const handleShare = (data: MovieRecommendation) => {
    setCardData({
      id: data.id,
      media_type: "movie",
      title: data.name,
      name: data.name,
      poster_path: data.poster_url,
    });
    setIsModalOpen(true);
  };

  const fetchRecommendations = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/personalRecommendations");
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch recommendations");
      }
      const data: MovieRecommendation[] = await response.json();
      setRecommendations(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <SendMessageModal
        media_type={"movie"}
        data={cardData}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      <div className="flex justify-center">
        <button
          onClick={fetchRecommendations}
          disabled={isLoading}
          aria-busy={isLoading}
          className="px-6 py-2.5 bg-brand-500 text-surface-950 font-semibold rounded-full hover:bg-brand-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[200px] transition-all duration-200 active:scale-[0.98] hover:shadow-lg hover:shadow-brand-500/20"
        >
          {isLoading ? (
            <>
              <LoadingSpinner size="sm" className="border-t-surface-950 shrink-0" />
              <span>Finding picks…</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Get AI Recommendations
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 text-red-300 text-sm">
          {error}
        </div>
      )}

      {recommendations.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {recommendations.map((data) => {
            const genres = Array.isArray(data.genres)
              ? data.genres.filter(Boolean)
              : [];
            return (
              <MediaCard
                key={data.id}
                id={Number(data.id)}
                title={data.name}
                mediaType="movie"
                imageUrl={data.poster_url}
                adult={false}
                genres={genres}
                showActions={true}
                onShare={() => handleShare(data)}
                typeLabel="movie"
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
