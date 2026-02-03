"use client";
import { useState } from "react";
import MediaCard from "@components/cards/MediaCard";
import SendMessageModal from "@components/message/sendCard";

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
      console.error(err);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
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
          className="px-5 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? "Loading..." : "Get recommendations"}
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">
          {error}
        </div>
      )}

      {recommendations.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
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
