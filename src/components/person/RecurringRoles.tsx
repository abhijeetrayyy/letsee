import Link from "@components/ui/AppLink";

/**
 * The same character, across years.
 *
 * Free from data already in hand, and the kind of fact a filmography usually
 * makes you assemble yourself: Woody eleven times over thirty-one years,
 * Ethan Hunt eight.
 */
import { titlePath } from "@/utils/urls";
export default function RecurringRoles({
  roles,
}: {
  roles: { label: string; count: number; from: number | null; to: number | null; titles: { key: string; id: number; mediaType: string; title: string; posterPath: string | null }[] }[];
}) {
  if (roles.length === 0) return null;
  return (
    <ul className="space-y-4">
      {roles.slice(0, 4).map((r) => (
        <li key={r.label}>
          <p className="text-sm text-surface-200">
            {r.label}
            <span className="text-surface-500">
              {" "}· <span className="font-mono tabular-nums">{r.count}</span> times
              {r.from != null && r.to != null && r.from !== r.to ? ` · ${r.from}–${r.to}` : r.from != null ? ` · ${r.from}` : ""}
            </span>
          </p>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {r.titles.map((t) => (
              <Link key={t.key} href={titlePath(t.mediaType, t.id, t.title)} title={t.title} className="shrink-0">
                <span className="block h-[96px] w-16 overflow-hidden rounded bg-surface-800 ring-1 ring-surface-700/40 transition hover:ring-brand-500/40">
                  {t.posterPath && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={`https://image.tmdb.org/t/p/w185${t.posterPath}`} alt={t.title} loading="lazy" className="h-full w-full object-cover" />
                  )}
                </span>
              </Link>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
