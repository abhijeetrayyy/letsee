"use client";

import React, { useState, useEffect } from "react";
import { FaStar } from "react-icons/fa";

interface EpisodeRatingProps {
  showId: string;
  seasonNumber: number;
  episodeNumber: number;
  initialRating?: number | null;
}

export default function EpisodeRating({
  showId,
  seasonNumber,
  episodeNumber,
  initialRating,
}: EpisodeRatingProps) {
  const [rating, setRating] = useState<number | null>(initialRating || null);
  const [hover, setHover] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // If initialRating is undefined, we could fetch it.
  // Assuming parent fetches or we fetch on mount if needed.
  useEffect(() => {
    if (initialRating !== undefined) setRating(initialRating);
  }, [initialRating]);

  useEffect(() => {
    if (initialRating === undefined) {
      fetch(
        `/api/episode-rating?showId=${showId}&seasonNumber=${seasonNumber}&episodeNumber=${episodeNumber}`,
      )
        .then((r) => r.json())
        .then((d) => {
          if (typeof d.score === "number") setRating(d.score);
        })
        .catch(() => {});
    }
  }, [showId, seasonNumber, episodeNumber, initialRating]);

  const handleRate = async (score: number) => {
    // Optimistic
    const prev = rating;
    setRating(score);
    setLoading(true);

    try {
      // We need to fetch current note too? Or assuming API handles partial update?
      // Our API upserts. If we only send score, note becomes null unless we fetch existing first.
      // Ideally API should support PATCH merging, OR we need to load both.
      // Let's assume we load both in parent or here.
      // For now, simpler: we need to pass current note if we want to preserve it?
      // Actually, standard SQL upsert overwrites.
      // To support partial updates, we should change API to fetch-then-update or use COALESCE in SQL.
      // But Supabase .upsert replaces whole row if not specified?
      // Actually .upsert updates columns specified. If note is missing, does it set to null?
      // No, if we pass {score}, note might be unaffected if we use specific query?
      // Supabase upsert requires all non-default columns or will set them to null?
      // Let's check API.

      // The API implementation I wrote:
      // upsert({ ... score: score, note: note ... })
      // If note is undefined in body, it passes undefined to upsert?
      // JSON.stringify will omit undefined.
      // So body.note might be undefined.
      // Upsert behavior with missing keys: it usually updates only the provided keys if we use .update on conflict match?
      // Actually upsert is "INSERT ... ON CONFLICT DO UPDATE".
      // If we don't provide 'note', does it keep observable value?
      // We should verify.

      // Safest: Provide note.
      // But we don't have note here.
      // We should separate rating and note components or manage state together.
      // Let's create a combined hook or fetch both.

      // Re-reading logic: best to have them separate but share data context?
      // Or just fetch existing note first inside API?
      // Or change API to: if note is undefined, don't update it.

      // Let's assume API needs improvement for partial updates or we fetch in component.

      // Better approach: merge fetch in a custom hook or just fetch here quickly.
      // We'll update API to handle partial updates properly (using .update if exists or slightly complex upsert).
      // Or simply:

      const res = await fetch("/api/episode-rating", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          showId,
          seasonNumber,
          episodeNumber,
          score,
          // We don't send note. API needs to handle this.
          // I will update API to be robust.
        }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setRating(prev);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      {[...Array(10)].map((_, i) => {
        const ratingValue = i + 1;
        return (
          <label key={i} className="cursor-pointer">
            <input
              type="radio"
              name="rating"
              value={ratingValue}
              onClick={() => handleRate(ratingValue)}
              className="hidden"
            />
            <FaStar
              className="transition-colors duration-200"
              color={
                ratingValue <= (hover || rating || 0) ? "#f59e0b" : "#4b5563"
              }
              size={18} // Smaller than show rating
              onMouseEnter={() => setHover(ratingValue)}
              onMouseLeave={() => setHover(null)}
            />
          </label>
        );
      })}
      <span className="ml-2 text-sm text-neutral-400">
        {rating ? `${rating}/10` : "Rate"}
      </span>
    </div>
  );
}
