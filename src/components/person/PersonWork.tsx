"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Film, Tv, Mic, UserCircle2 } from "lucide-react";
import ThreePrefrenceBtn from "@components/buttons/threePrefrencebtn";
import type { Credit } from "@/utils/person/model";

/**
 * The filmography, in two lists that are both always on screen.
 *
 * This replaced a row of department tabs, for two reasons that measuring made
 * obvious.
 *
 * A tab is a step, and a step is a filter on who ever sees the content. The
 * people whose work is mostly behind the camera had their entire career one
 * click down; so did the more interesting fact, which is that almost every
 * actor has some. Measured across ten people, every single one had crew
 * credits — Emily Blunt 6, Tom Holland 7, Scarlett Johansson 13 (including
 * *Eleanor the Great*, which she directed), Tom Cruise 27, Tom Hanks 61, and
 * Leonardo DiCaprio 68, which is more producing credits than acting ones. None
 * of that was visible without knowing to go looking for it.
 *
 * And the tabs were double-counting. One title per department meant Nolan's
 * *Interstellar* appeared under Directing, Writing and Production as three
 * separate rows: 71 rows rendered for 28 real titles, 43 of them duplicates.
 * One row per title, naming every job on it, is both shorter and truer —
 * "Interstellar · Director, Writer, Producer" is the actual fact.
 */

const PAGE = 30;

function roleText(c: Credit, mode: "screen" | "behind"): string | null {
  if (mode === "behind") return c.jobs.length ? c.jobs.join(", ") : null;
  if (c.characters.length) {
    const chars = c.characters.slice(0, 2).join(" / ");
    return c.episodeCount > 1 ? `${chars} · ${c.episodeCount} eps` : chars;
  }
  return null;
}

function CreditRow({ c, mode }: { c: Credit; mode: "screen" | "behind" }) {
  const role = roleText(c, mode);
  const Icon = c.mediaType === "tv" ? Tv : Film;

  return (
    <li className="flex items-center gap-3 py-3">
      <span className="w-11 shrink-0 text-right font-mono text-[13px] tabular-nums text-surface-500">
        {c.year ?? "—"}
      </span>
      <Link href={`/app/${c.mediaType}/${c.id}`} className="group flex min-w-0 flex-1 items-center gap-3.5">
        <span className="h-[72px] w-12 shrink-0 overflow-hidden rounded-md bg-surface-800 ring-1 ring-surface-700/40">
          {c.posterPath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`https://image.tmdb.org/t/p/w185${c.posterPath}`}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center">
              <Icon className="size-4 text-surface-600" aria-hidden />
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[15px] font-medium text-surface-100 transition-colors group-hover:text-white">
              {c.title}
            </span>
            {c.flags.voice && <Mic className="size-3.5 shrink-0 text-surface-500" aria-label="Voice" />}
            {c.bucket === "presenting" && (
              <UserCircle2 className="size-3.5 shrink-0 text-surface-500" aria-label="As themselves" />
            )}
          </span>
          {role && <span className="mt-1 block truncate text-sm text-surface-400">{role}</span>}
        </span>
        {c.voteAverage > 0 && c.voteCount > 50 && (
          <span className="shrink-0 font-mono text-sm tabular-nums text-surface-400">
            {c.voteAverage.toFixed(1)}
          </span>
        )}
      </Link>
      <span className="shrink-0">
        <ThreePrefrenceBtn
          cardId={c.id}
          cardType={c.mediaType}
          cardName={c.title}
          cardImg={c.posterPath}
          genres={[]}
          variant="compact"
        />
      </span>
    </li>
  );
}

function CreditList({ credits, mode }: { credits: Credit[]; mode: "screen" | "behind" }) {
  const [shown, setShown] = useState(PAGE);
  return (
    <>
      <ul className="divide-y divide-surface-800/70">
        {credits.slice(0, shown).map((c) => (
          <CreditRow key={c.key} c={c} mode={mode} />
        ))}
      </ul>
      {credits.length > shown && (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE)}
          className="mt-4 w-full rounded-xl border border-surface-700 py-2.5 text-sm text-surface-300 transition hover:border-surface-600 hover:text-white"
        >
          Show {Math.min(PAGE, credits.length - shown)} more
        </button>
      )}
    </>
  );
}

function Heading({ title, count }: { title: string; count: number }) {
  return (
    <h3 className="mb-1 flex items-baseline gap-2 text-lg font-semibold text-white">
      {title}
      <span className="font-mono text-sm tabular-nums font-normal text-surface-500">{count}</span>
    </h3>
  );
}

export default function PersonWork({
  credits,
  knownForDepartment,
}: {
  credits: Credit[];
  knownForDepartment: string | null;
}) {
  const { screen, behind } = useMemo(() => {
    const work = credits.filter((c) => c.bucket === "performance" || c.bucket === "presenting");
    const byDate = (a: Credit, b: Credit) => {
      if (!a.date && !b.date) return b.voteCount - a.voteCount;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date.localeCompare(a.date);
    };
    return {
      screen: work.filter((c) => c.characters.length > 0).sort(byDate),
      behind: work.filter((c) => c.isCrew && c.jobs.length > 0).sort(byDate),
    };
  }, [credits]);

  // A director's page opens on directing. An actor's opens on acting, and the
  // crew list underneath is the reveal rather than the headline.
  const behindFirst = (knownForDepartment ?? "Acting") !== "Acting";

  const screenBlock = screen.length > 0 && (
    <div key="screen">
      <Heading title="On screen" count={screen.length} />
      <CreditList credits={screen} mode="screen" />
    </div>
  );
  const behindBlock = behind.length > 0 && (
    <div key="behind">
      <Heading title="Behind the camera" count={behind.length} />
      <CreditList credits={behind} mode="behind" />
    </div>
  );

  if (!screenBlock && !behindBlock) return null;

  return (
    <div className="space-y-10">
      {behindFirst ? [behindBlock, screenBlock] : [screenBlock, behindBlock]}
    </div>
  );
}
