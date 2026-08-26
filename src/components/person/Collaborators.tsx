import Link from "@components/ui/AppLink";
import { Users } from "lucide-react";
import type { Collaborator } from "@/utils/person/collaborators";
import { personPath } from "@/utils/urls";

/**
 * The "related people" ask, answered by computation.
 *
 * Each tile carries its evidence — the titles they actually share — because a
 * bare face grid asks you to take the association on trust, and this
 * association is derived rather than declared.
 */
function List({ title, people }: { title: string; people: Collaborator[] }) {
  if (people.length < 4) return null;
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-surface-400">{title}</h3>
      <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
        {people.map((p) => (
          <Link key={p.id} href={personPath(p.id, p.name)} className="group w-28 shrink-0 sm:w-32">
            <div className="aspect-[2/3] w-full overflow-hidden rounded-xl bg-surface-800 ring-1 ring-surface-700/50 transition-all group-hover:ring-brand-500/40">
              {p.profilePath ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={`https://image.tmdb.org/t/p/w342${p.profilePath}`} alt={p.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              ) : (
                <div className="flex h-full w-full items-center justify-center"><Users className="size-6 text-surface-600" aria-hidden /></div>
              )}
            </div>
            <p className="mt-2 line-clamp-1 text-sm font-medium text-surface-200 transition-colors group-hover:text-white">{p.name}</p>
            <p className="line-clamp-1 text-xs text-surface-500">
              {p.job ? `${p.job} · ` : ""}{p.count} together
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function Collaborators({
  onScreen,
  behind,
  showOnScreen,
}: {
  onScreen: Collaborator[];
  behind: Collaborator[];
  /**
   * Suppressed for crew. A stunt double was in the same films as the star, not
   * in scenes with them — "on screen with" would be a claim the data cannot
   * support.
   */
  showOnScreen: boolean;
}) {
  const a = showOnScreen ? onScreen : [];
  if (a.length < 4 && behind.length < 4) return null;
  return (
    <div className="space-y-6">
      <List title="On screen with" people={a} />
      <List title="Behind the camera with" people={behind} />
    </div>
  );
}
