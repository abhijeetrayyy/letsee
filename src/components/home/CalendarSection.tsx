"use client";

import React from "react";
import { useApiFetch } from "@/hooks/useApiFetch";
import { FetchError } from "@/components/ui/FetchError";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import HomeContentTile from "@components/movie/homeContentTile";

type CalendarData = {
  nowPlaying: { results: any[] };
  tvAiring: { results: any[] };
};

type CalendarSectionProps = { hideMainHeading?: boolean };

export default function CalendarSection({
  hideMainHeading,
}: CalendarSectionProps = {}) {
  const { data, error, loading, refetch } = useApiFetch<CalendarData>(
    "/api/calendar",
    {
      credentials: "include",
      enabled: true,
    }
  );

  if (loading) {
    return (
      <div className="w-full mx-auto flex justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full mx-auto">
        <FetchError message={error} onRetry={refetch} />
      </div>
    );
  }

  const nowPlaying = data?.nowPlaying?.results ?? [];
  const tvAiring = data?.tvAiring?.results ?? [];

  if (nowPlaying.length === 0 && tvAiring.length === 0) {
    return null;
  }

  return (
    <div className="w-full space-y-8">
      {!hideMainHeading && (
        <h2 className="text-2xl font-bold text-surface-100">
          Calendar &amp; upcoming
        </h2>
      )}
      {nowPlaying.length > 0 && (
        <div>
          <h3 className="text-base font-semibold text-surface-300 mb-3">
            In theaters
          </h3>
          <HomeContentTile type="movie" data={{ results: nowPlaying }} />
        </div>
      )}
      {tvAiring.length > 0 && (
        <div>
          <h3 className="text-base font-semibold text-surface-300 mb-3">
            TV this week
          </h3>
          <HomeContentTile type="tv" data={{ results: tvAiring }} />
        </div>
      )}
    </div>
  );
}
