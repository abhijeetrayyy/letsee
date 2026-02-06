type Stat = { value: number | null; label: string };

const HIDE_VOTING = process.env.NEXT_PUBLIC_HIDE_VOTING === "true";

export default function ProfileStatsStrip({
  stats,
  moviesCount,
  tvCount,
  episodesCount = 0,
}: {
  stats: Stat[];
  moviesCount: number;
  tvCount: number;
  episodesCount?: number;
}) {
  const total = moviesCount + tvCount;
  const moviePct = total > 0 ? (moviesCount / total) * 100 : 50;
  const showPercentageBar = !HIDE_VOTING && (total > 0 || episodesCount > 0);

  return (
    <section className="w-full rounded-2xl border border-neutral-700/60 bg-neutral-800/40 px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4 sm:gap-6">
        <div className="flex flex-wrap items-baseline gap-4 sm:gap-6 md:gap-8">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col">
              <span className="text-2xl sm:text-3xl font-bold text-white tabular-nums">
                {s.value ?? 0}
              </span>
              <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider mt-0.5">
                {s.label}
              </span>
            </div>
          ))}
        </div>
        {showPercentageBar && (
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex rounded-full overflow-hidden bg-neutral-700/80 w-20 sm:w-24 h-2 shrink-0">
              <div
                className="h-full bg-amber-500/90 rounded-l-full transition-all"
                style={{ width: `${moviePct}%` }}
              />
            </div>
            <span className="text-xs text-neutral-500 whitespace-nowrap truncate">
              {moviesCount} film · {tvCount} TV
              {episodesCount > 0 ? ` · ${episodesCount} ep` : ""}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
