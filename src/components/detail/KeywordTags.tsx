"use client";

import Link from "next/link";
import { Hash } from "lucide-react";

type Keyword = {
  id: number;
  name: string;
};

export default function KeywordTags({ keywords }: { keywords: Keyword[] }) {
  if (!keywords || keywords.length === 0) return null;

  const displayKeywords = keywords.slice(0, 15);

  return (
    <div className="card-accent rounded-2xl p-5 animate-fade-up stagger-3">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-1 h-6 rounded-full bg-brand-500 shrink-0" />
        <h3 className="text-sm font-semibold text-surface-100">Keywords & Themes</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {displayKeywords.map((kw) => (
          <Link
            key={kw.id}
            href={`/app/search/${encodeURIComponent(kw.name)}`}
            className="chip-surface"
          >
            {kw.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
