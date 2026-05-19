"use client";

import Link from "next/link";
import { buildSearchUrl } from "@/utils/searchUrl";
import { BROWSE_TAGS, type BrowseTag } from "@/staticData/browseTags";

function getTagHref(tag: BrowseTag): string {
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

function getTagKey(tag: BrowseTag, index: number): string {
  if (tag.type === "special") return `special-${tag.label}-${index}`;
  return `${tag.type}-${tag.mediaType}-${tag.id}-${index}`;
}

export default function BrowseTags() {
  return (
    <div className="flex flex-wrap gap-2">
      {BROWSE_TAGS.map((tag, i) => (
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
