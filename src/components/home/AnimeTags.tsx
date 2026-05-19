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
          className="pill-glass"
        >
          {tag.label}
        </Link>
      ))}
    </div>
  );
}
