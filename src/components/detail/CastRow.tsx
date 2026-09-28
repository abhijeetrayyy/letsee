import Link from "@components/ui/AppLink";
import { ArrowRight, Users } from "lucide-react";
import { personPath } from "@/utils/urls";

type CastMember = {
  id: number;
  name: string;
  character?: string;
  profile_path?: string | null;
};

/**
 * Cast strip. Portraits rather than small circles — faces are the point, and
 * at 80px in a circle most of the head was cropped away.
 */
export default function CastRow({
  cast = [],
  fullCreditsHref,
}: {
  cast?: CastMember[];
  fullCreditsHref?: string;
}) {
  if (cast.length === 0) return null;

  return (
    <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
      {cast.slice(0, 20).map((actor) => (
        <Link
          key={actor.id}
          href={personPath(actor.id, actor.name)}
          className="group w-28 shrink-0 sm:w-32"
        >
          <div className="aspect-[2/3] w-full overflow-hidden rounded-xl bg-surface-800 ring-1 ring-surface-700/50 transition-all group-hover:ring-brand-500/40">
            {actor.profile_path ? (
              <img
                src={`https://image.tmdb.org/t/p/w342${actor.profile_path}`}
                alt={actor.name}
                loading="lazy"
                className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="flex size-full items-center justify-center">
                <Users className="size-7 text-surface-600" />
              </div>
            )}
          </div>
          <p className="mt-2 line-clamp-1 text-sm font-medium text-surface-200 transition-colors group-hover:text-white">
            {actor.name}
          </p>
          {actor.character && (
            <p className="line-clamp-1 text-xs text-surface-500">{actor.character}</p>
          )}
        </Link>
      ))}
      {fullCreditsHref && cast.length > 0 && (
        <Link
          href={fullCreditsHref}
          className="group flex w-28 shrink-0 flex-col sm:w-32"
          aria-label="View the full cast and crew"
        >
          <span className="flex aspect-[2/3] w-full items-center justify-center rounded-xl border border-dashed border-surface-700 bg-surface-900/60 text-surface-400 transition-colors group-hover:border-brand-500/50 group-hover:text-brand-300">
            <ArrowRight className="size-6" />
          </span>
          <span className="mt-2 text-sm font-medium text-surface-300 group-hover:text-white">
            Full cast &amp; crew
          </span>
        </Link>
      )}
    </div>
  );
}
