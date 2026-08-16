"use client";

import { useState, useRef } from "react";
import { Share2, Camera, Download } from "lucide-react";
import { getPosterUrl } from "@/utils/imageUrl";

interface ShareProfileCardProps {
  username: string;
  avatarUrl: string;
  tagline?: string | null;
  stats: {
    watchedCount: number;
    favoriteCount: number;
    watchlistCount: number;
    followersCount: number;
    followingCount: number;
  };
  topGenres: string[];
  tasteInFour: { image_url: string | null; item_name: string }[];
}

export default function ShareProfileCard({
  username,
  avatarUrl,
  tagline,
  stats,
  topGenres,
  tasteInFour,
}: ShareProfileCardProps) {
  const [capturing, setCapturing] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleExport = async () => {
    if (!cardRef.current) return;
    setCapturing(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: "#0d1117",
        scale: 2,
        useCORS: true,
      });
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `letsee-${username}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {}
    setCapturing(false);
  };

  return (
    <div className="relative">
      <button
        onClick={handleExport}
        disabled={capturing}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-800 hover:bg-surface-700 text-xs text-surface-300 transition-colors"
      >
        {capturing ? <Download className="size-3.5 animate-pulse" /> : <Camera className="size-3.5" />}
        Share profile
      </button>

      {/* Hidden render target for export.
          Every colour in here is inline rgba rather than a Tailwind
          `/opacity` class. Tailwind v4 compiles `bg-white/5` to
          `oklab(... / 0.05)`, and html2canvas 1.4 throws outright on any
          unsupported colour function — so a single such class anywhere in this
          subtree makes the export button silently fail. */}
      <div className="fixed -left-[9999px] top-0" aria-hidden>
        <div
          ref={cardRef}
          className="w-[800px] p-10"
          style={{ background: "linear-gradient(135deg, #0d1117 0%, #161b22 50%, #1c2333 100%)" }}
        >
          {/* Header */}
          <div className="flex items-center gap-5 mb-8">
            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-surface-800 border-2 flex-shrink-0"
              style={{ borderColor: "rgba(34,197,94,0.3)" }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt={username} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-surface-400">
                  {username[0]?.toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">@{username}</h1>
              {tagline && (
                <p className="text-lg text-surface-400 italic mt-1">&quot;{tagline}&quot;</p>
              )}
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-5 gap-4 mb-8">
            {[
              { label: "Watched", value: stats.watchedCount },
              { label: "Favorites", value: stats.favoriteCount },
              { label: "Watchlist", value: stats.watchlistCount },
              { label: "Followers", value: stats.followersCount },
              { label: "Following", value: stats.followingCount },
            ].map((s) => (
              <div key={s.label} className="rounded-xl p-4 text-center" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
                <span className="block text-2xl font-bold text-white tabular-nums">{formatNum(s.value)}</span>
                <span className="text-xs text-surface-500 uppercase tracking-wider">{s.label}</span>
              </div>
            ))}
          </div>

          {/* Taste in Four */}
          {tasteInFour.length > 0 && (
            <div className="mb-8">
              <h3 className="text-sm font-semibold text-surface-400 uppercase tracking-wider mb-3">
                Top 4 Favorites
              </h3>
              <div className="grid grid-cols-4 gap-3">
                {tasteInFour.map((item, i) => (
                  <div key={i} className="rounded-xl overflow-hidden bg-surface-800 aspect-[2/3]">
                    {item.image_url ? (
                      <img src={getPosterUrl(item.image_url)} alt={item.item_name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-surface-600 text-xs">
                        {item.item_name}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top genres */}
          {topGenres.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {topGenres.map((g) => (
                <span key={g} className="px-3 py-1.5 rounded-full text-brand-300 text-sm border"
                  style={{ backgroundColor: "rgba(34,197,94,0.1)", borderColor: "rgba(34,197,94,0.2)" }}>
                  {g}
                </span>
              ))}
            </div>
          )}

          {/* Footer */}
          <p className="text-sm text-surface-500 text-center border-t pt-4" style={{ borderTopColor: "rgba(255,255,255,0.05)" }}>
            letsee.app · The social film journal
          </p>
        </div>
      </div>
    </div>
  );
}

function formatNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}
