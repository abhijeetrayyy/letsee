"use client";

import ProfileCurrentlyWatching from "./ProfileCurrentlyWatching";
import ProfileWatched from "./profileWatched";

interface Props {
  userId: string;
  isOwner: boolean;
  type: "tv" | "movie";
  sectionTitle: string;
}

export default function ProfileAnimeSection({
  userId,
  isOwner,
  type,
  sectionTitle,
}: Props) {
  return (
    <section aria-labelledby={`anime-${type}-heading`}>
      <h2 id={`anime-${type}-heading`} className="text-xl sm:text-2xl font-bold text-white tracking-tight mb-4">
        {sectionTitle}
      </h2>
      <div className="rounded-2xl border border-neutral-700/60 bg-neutral-800/30 p-6 space-y-6">
        <div>
          <h3 className="text-sm font-medium text-neutral-400 mb-2">
            Watching
          </h3>
          <ProfileCurrentlyWatching
            userId={userId}
            animeOnly
            itemType={type}
          />
        </div>
        <div>
          <h3 className="text-sm font-medium text-neutral-400 mb-2">
            Watched
          </h3>
          <ProfileWatched
            userId={userId}
            isOwner={isOwner}
            genreFilter="Animation"
            itemType={type}
            hideGenreFilter
          />
        </div>
      </div>
    </section>
  );
}
