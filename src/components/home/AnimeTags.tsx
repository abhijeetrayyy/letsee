"use client";

import Link from "next/link";
import { buildSearchUrl } from "@/utils/searchUrl";
import { ANIME_TAGS, type AnimeTag } from "@/staticData/animeTags";

function getTagHref(tag: AnimeTag): string {
  switch (tag.type) {
    case "genre":
      return tag.mediaType === "movie"
        ? `/app/moviebygenre/list/${tag.id}-${tag.label}`
        : `/app/tvbygenre/list/${tag.id}-${tag.label}`;
    case "keyword":
      return buildSearchUrl({
        query: "discover",
        mediaType: tag.mediaType,
        keyword: String(tag.id),
      });
    case "special":
      return tag.href;
    default:
      return "#";
  }
}

function getTagKey(tag: AnimeTag, index: number): string {
  if (tag.type === "special") return `special-${tag.label}-${index}`;
  return `${tag.type}-${tag.mediaType}-${tag.id}-${index}`;
}

export default function AnimeTags() {
  return (
    <div className="flex flex-wrap gap-2">
      {ANIME_TAGS.map((tag, i) => (
        <Link
          key={getTagKey(tag, i)}
          href={getTagHref(tag)}
          className="inline-flex items-center rounded-full border border-neutral-600 bg-neutral-800/80 px-4 py-2 text-sm font-medium text-neutral-200 transition-colors hover:border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-2 focus:ring-offset-neutral-900"
        >
          {tag.label}
        </Link>
      ))}
    </div>
  );
}
