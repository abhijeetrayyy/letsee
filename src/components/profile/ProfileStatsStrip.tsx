type Stat = { value: number | null; label: string };

export default function ProfileStatsStrip({
  stats,
  moviesCount,
  tvCount,
}: {
  stats: Stat[];
  moviesCount: number;
  tvCount: number;
}) {
  const total = moviesCount + tvCount;
  const moviePct = total > 0 ? (moviesCount / total) * 100 : 50;

  return (
    <section className="w-full rounded-2xl border border-neutral-700/60 bg-neutral-800/40 px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="flex flex-wrap items-baseline gap-6 sm:gap-8">
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
        {total > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex rounded-full overflow-hidden bg-neutral-700/80 w-24 h-2">
              <div
                className="h-full bg-amber-500/90 rounded-l-full transition-all"
                style={{ width: `${moviePct}%` }}
              />
            </div>
            <span className="text-xs text-neutral-500 whitespace-nowrap">
              {moviesCount} film · {tvCount} TV
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
