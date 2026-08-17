import { User } from "lucide-react";
import { FaInstagram, FaXTwitter, FaImdb } from "react-icons/fa6";
import { HiOutlineGlobeAlt } from "react-icons/hi2";
import type { PersonLife } from "@/utils/person/dates";

/**
 * Who this is, in one screen.
 *
 * Built for the 82% of TMDB people who have no biography as much as for the
 * 18% who do — so everything on it except the portrait is derived from the
 * filmography, which everyone has.
 */
export default function PersonHero({
  name,
  profilePath,
  roleLine,
  careerLine,
  life,
  externalIds,
  posterWall,
}: {
  name: string;
  profilePath: string | null;
  roleLine: string | null;
  careerLine: string | null;
  life: PersonLife;
  externalIds?: Record<string, string | null>;
  /** Poster paths from their own work, used as ground. Free — already fetched. */
  posterWall: string[];
}) {
  const links = [
    externalIds?.instagram_id && { href: `https://instagram.com/${externalIds.instagram_id}`, Icon: FaInstagram, label: "Instagram" },
    externalIds?.twitter_id && { href: `https://x.com/${externalIds.twitter_id}`, Icon: FaXTwitter, label: "X" },
    externalIds?.imdb_id && { href: `https://www.imdb.com/name/${externalIds.imdb_id}`, Icon: FaImdb, label: "IMDb" },
    externalIds?.homepage && { href: externalIds.homepage, Icon: HiOutlineGlobeAlt, label: "Website" },
  ].filter(Boolean) as { href: string; Icon: React.ComponentType<{ className?: string }>; label: string }[];

  return (
    <div className="relative overflow-hidden">
      {/* Ground, not decoration. Their own posters, blurred back almost to
          texture — it costs no request because every poster_path is already on
          the credits payload. Below twelve it reads as a mistake, so it
          doesn't render at all. */}
      {posterWall.length >= 12 && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 grid grid-cols-6 opacity-[0.14] saturate-50 sm:grid-cols-8"
          style={{ maskImage: "linear-gradient(to bottom, black, transparent 82%)", WebkitMaskImage: "linear-gradient(to bottom, black, transparent 82%)" }}
        >
          {posterWall.slice(0, 16).map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={`${p}-${i}`} src={`https://image.tmdb.org/t/p/w185${p}`} alt="" loading="lazy" className="h-full w-full object-cover" />
          ))}
        </div>
      )}

      <div className="relative grid gap-6 sm:grid-cols-[200px_1fr]">
        <div className="mx-auto w-32 shrink-0 sm:mx-0 sm:w-[200px]">
          <div className="aspect-[2/3] overflow-hidden rounded-2xl bg-surface-800 ring-1 ring-surface-700/50">
            {profilePath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`https://image.tmdb.org/t/p/h632${profilePath}`}
                alt={name}
                width={421}
                height={632}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <User className="size-10 text-surface-600" aria-hidden />
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-5xl">{name}</h1>

          {roleLine && <p className="mt-2 text-base text-brand-400">{roleLine}</p>}
          {careerLine && <p className="mt-1 text-sm text-surface-400">{careerLine}</p>}

          {life.hasAnything && (
            /* A real <dl>. The old markup was icons beside bare strings, which
               reads to a screen reader as a pile of unlabelled dates. */
            <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {life.born && (
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-surface-500">Born</dt>
                  <dd className="text-surface-200">
                    <time dateTime={life.born.iso}>{life.born.label}</time>
                    {/* The number people actually came for. */}
                    {life.age != null && <span className="text-surface-400"> · {life.age}</span>}
                  </dd>
                </div>
              )}
              {life.died && (
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-surface-500">Died</dt>
                  <dd className="text-surface-200">
                    <time dateTime={life.died.iso}>{life.died.label}</time>
                    {/* Age AT death — the current age of someone who has died
                        is not a smaller mistake than no age at all. */}
                    {life.ageAtDeath != null && <span className="text-surface-400"> · aged {life.ageAtDeath}</span>}
                  </dd>
                </div>
              )}
              {life.place && (
                <div className="min-w-0">
                  <dt className="text-[11px] uppercase tracking-wider text-surface-500">From</dt>
                  <dd className="truncate text-surface-200">{life.place}</dd>
                </div>
              )}
            </dl>
          )}

          {links.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {links.map(({ href, Icon, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="rounded-full border border-surface-700 p-2 text-surface-300 transition hover:border-surface-600 hover:text-white"
                >
                  <Icon className="size-4" />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
