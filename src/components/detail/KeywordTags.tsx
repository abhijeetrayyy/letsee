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
    <div className="rounded-2xl border border-surface-700/40 bg-surface-900/40 backdrop-blur-sm p-5">
      <h3 className="text-sm font-semibold text-surface-200 flex items-center gap-2 mb-3">
        <Hash className="w-4 h-4 text-brand-400" />
        Keywords & Themes
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {displayKeywords.map((kw) => (
          <Link
            key={kw.id}
            href={`/app/search/${encodeURIComponent(kw.name)}`}
            className="px-2.5 py-1 rounded-full bg-surface-800/60 border border-surface-700/30 text-surface-300 text-xs font-medium hover:bg-surface-700 hover:text-white hover:border-surface-600/50 transition-all"
          >
            {kw.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
