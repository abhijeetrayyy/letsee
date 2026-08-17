"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Film, Tv, Mic, UserCircle2 } from "lucide-react";
import ThreePrefrenceBtn from "@components/buttons/threePrefrencebtn";
import type { Credit } from "@/utils/person/model";

/**
 * The filmography, and the page's centre of gravity.
 *
 * Lenses are client state rather than `?lens=` in the URL, deliberately.
 * Reading searchParams on the server turns the route dynamic and gives up the
 * Full Route Cache — every visitor would then pay a throttle slot and a
 * re-parse of a payload up to 395KB, to buy a shareable filter nobody shares.
 * All lenses ship in one payload instead; measured worst case (Spielberg,
 * every lens) is 64KB, and switching costs no round trip at all.
 *
 * A lens is only generated when it has content, which makes "no credits match
 * your filters" unreachable rather than merely unlikely.
 */

type Lens = { id: string; label: string; credits: Credit[] };

const GLYPH = {
  voice: { Icon: Mic, label: "Voice" },
  self: { Icon: UserCircle2, label: "As themselves" },
};

function roleText(c: Credit): string | null {
  if (c.characters.length) {
    const chars = c.characters.slice(0, 2).join(" / ");
    return c.episodeCount > 1 ? `${chars} · ${c.episodeCount} eps` : chars;
  }
  if (c.jobs.length) return c.jobs.slice(0, 3).join(", ");
  return null;
}

function CreditRow({ c, showActions }: { c: Credit; showActions: boolean }) {
  const role = roleText(c);
  const href = `/app/${c.mediaType}/${c.id}`;
  const Icon = c.mediaType === "tv" ? Tv : Film;

  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="w-10 shrink-0 text-right font-mono text-xs tabular-nums text-surface-500">
        {c.year ?? "—"}
      </span>
      <Link href={href} className="group flex min-w-0 flex-1 items-center gap-3">
        <span className="h-[54px] w-9 shrink-0 overflow-hidden rounded bg-surface-800">
          {c.posterPath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`https://image.tmdb.org/t/p/w92${c.posterPath}`} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center">
              <Icon className="size-3.5 text-surface-600" aria-hidden />
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium text-surface-100 transition-colors group-hover:text-white">
              {c.title}
            </span>
            {c.flags.voice && <GLYPH.voice.Icon className="size-3 shrink-0 text-surface-500" aria-label={GLYPH.voice.label} />}
            {c.bucket === "presenting" && <GLYPH.self.Icon className="size-3 shrink-0 text-surface-500" aria-label={GLYPH.self.label} />}
          </span>
          {role && <span className="mt-0.5 block truncate text-xs text-surface-500">{role}</span>}
        </span>
        {c.voteAverage > 0 && c.voteCount > 50 && (
          <span className="shrink-0 font-mono text-xs tabular-nums text-surface-400">
            {c.voteAverage.toFixed(1)}
          </span>
        )}
      </Link>
      {showActions && (
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
      )}
    </li>
  );
}

const PAGE = 40;

export default function PersonWork({
  credits,
  knownForDepartment,
}: {
  credits: Credit[];
  knownForDepartment: string | null;
}) {
  const lenses = useMemo<Lens[]>(() => {
    const work = credits.filter((c) => c.bucket === "performance" || c.bucket === "presenting");
    const out: Lens[] = [];

    const acting = work.filter((c) => c.characters.length > 0 && c.bucket === "performance");
    const presenting = work.filter((c) => c.bucket === "presenting");

    // Department lenses, in the order people look for them.
    const DEPTS = ["Directing", "Writing", "Production", "Camera", "Sound", "Editing", "Art", "Crew"];
    const byDept = DEPTS.map((d) => ({
      id: d.toLowerCase(),
      label: d,
      credits: work.filter((c) => c.departments.includes(d)),
    })).filter((l) => l.credits.length > 0);

    // Whatever they are known for goes first — a director's page opens on
    // directing, not on the cameos they happen to have more of.
    const kfd = knownForDepartment ?? "Acting";
    if (kfd === "Acting") {
      if (acting.length) out.push({ id: "acting", label: "Acting", credits: acting });
      out.push(...byDept);
    } else {
      const own = byDept.find((l) => l.label === kfd);
      if (own) out.push(own);
      if (acting.length) out.push({ id: "acting", label: "Acting", credits: acting });
      out.push(...byDept.filter((l) => l.label !== kfd));
    }
    if (presenting.length) out.push({ id: "presenting", label: "Presenting", credits: presenting });

    // An "All" lens, because without one the complete filmography is never
    // viewable — a title in no listed department would be unreachable.
    if (out.length > 1) out.push({ id: "all", label: "All", credits: work });
    return out.filter((l) => l.credits.length > 0);
  }, [credits, knownForDepartment]);

  const [active, setActive] = useState(0);
  const [shown, setShown] = useState(PAGE);
  const lens = lenses[Math.min(active, lenses.length - 1)];

  const sorted = useMemo(() => {
    if (!lens) return [];
    return lens.credits.slice().sort((a, b) => {
      if (!a.date && !b.date) return b.voteCount - a.voteCount;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date.localeCompare(a.date);
    });
  }, [lens]);

  if (!lens) return null;

  return (
    <div>
      {lenses.length > 1 && (
        <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 no-scrollbar" role="tablist">
          {lenses.map((l, i) => (
            <button
              key={l.id}
              type="button"
              role="tab"
              aria-selected={i === active}
              onClick={() => { setActive(i); setShown(PAGE); }}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition ${
                i === active
                  ? "border-brand-500 bg-brand-500/10 text-brand-300"
                  : "border-surface-700 text-surface-400 hover:border-surface-600 hover:text-surface-200"
              }`}
            >
              {l.label} <span className="tabular-nums opacity-60">{l.credits.length}</span>
            </button>
          ))}
        </div>
      )}

      <ul className="divide-y divide-surface-800/70">
        {sorted.slice(0, shown).map((c) => (
          // Actions only on what is rendered — this is the app's primary verb,
          // and a filmography you cannot add from is the wrong trade.
          <CreditRow key={c.key} c={c} showActions />
        ))}
      </ul>

      {sorted.length > shown && (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE)}
          className="mt-4 w-full rounded-xl border border-surface-700 py-2.5 text-sm text-surface-300 transition hover:border-surface-600 hover:text-white"
        >
          Show {Math.min(PAGE, sorted.length - shown)} more
        </button>
      )}
    </div>
  );
}
