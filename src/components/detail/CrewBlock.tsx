import Link from "next/link";
import { personPath } from "@/utils/urls";

export type CrewMember = {
  id: number;
  name: string;
  job?: string;
  department?: string;
  /**
   * Arrives on every crew record in the same `credits` payload the detail page
   * already fetches, and was dropped on the floor here until now — the cast got
   * faces and the people who actually made the thing got a text list.
   */
  profile_path?: string | null;
};

export type CrewGroup = {
  department: string;
  people: { id: number; name: string; jobs: string[] }[];
};

/**
 * The departments worth naming, in the order people look for them.
 *
 * Everything else is dropped. A film's full crew is often ninety names across
 * twenty departments, and rendering all of it is not "more information" — it
 * is the same wall of text the separate /cast route already offers for anyone
 * who wants it. The discipline lives in the data rather than in a CSS height
 * cap, so the page never ships markup nobody reads.
 */
const DEPARTMENT_ORDER = ["Directing", "Writing", "Production", "Camera", "Sound", "Editing"];

/**
 * Group crew by department, collapsing one person's several jobs into one
 * entry.
 *
 * A person very often appears three times in the same department — "Producer",
 * "Executive Producer", "Co-Producer". Listing them three times is noise, and
 * keying a list on their id alone would be a duplicate-key bug. Both problems
 * disappear by merging jobs per person, which is what the person page already
 * does with the same payload.
 */
export function groupCrew(crew?: CrewMember[], maxPerDepartment = 6): CrewGroup[] {
  if (!Array.isArray(crew) || crew.length === 0) return [];

  const byDepartment = new Map<string, Map<number, { id: number; name: string; jobs: string[] }>>();

  for (const member of crew) {
    const dept = member.department ?? "";
    if (!DEPARTMENT_ORDER.includes(dept) || !member.id || !member.name) continue;

    const people = byDepartment.get(dept) ?? new Map();
    const existing = people.get(member.id);
    if (existing) {
      if (member.job && !existing.jobs.includes(member.job)) existing.jobs.push(member.job);
    } else {
      people.set(member.id, { id: member.id, name: member.name, jobs: member.job ? [member.job] : [] });
    }
    byDepartment.set(dept, people);
  }

  return DEPARTMENT_ORDER.filter((d) => byDepartment.has(d)).map((department) => ({
    department,
    people: [...byDepartment.get(department)!.values()].slice(0, maxPerDepartment),
  }));
}

/**
 * The jobs that carry a title, in the order you'd name them.
 *
 * Producer and Executive Producer are deliberately absent. They rank highly in
 * TMDB's ordering and would win most slots, and measured across ten shows that
 * produced a row reading Creator, Composer, Executive Producer, Executive
 * Producer, Executive Producer, Executive Producer — which is not what anyone
 * means by who made this. They keep their place in the department grid below.
 */
const JOB_RANK = [
  "Director",
  "Screenplay",
  "Writer",
  "Story",
  "Director of Photography",
  "Original Music Composer",
  "Editor",
];

export type KeyCrewMember = {
  id: number;
  name: string;
  /** The one ranked job that earned the tile, not every job they hold. */
  job: string;
  /** Non-null by construction — see `keyCrew`. */
  profile_path: string;
};

/**
 * The handful of people worth showing a face for.
 *
 * `groupCrew` fills each department to six from TMDB's arbitrary array order,
 * and the filler is the unphotographed tail: grips, boom operators, second
 * second assistant directors. Measured over 22 titles, only 46.6% of the people
 * it keeps have a photo at all, so pointing a portrait card at that selection
 * renders a grid of grey placeholders — *Wednesday* gives 2 faces and 15 icons.
 *
 * Ranking by job instead inverts that: the director, writer, cinematographer,
 * composer and editor are photographed nearly always, their crews nearly never.
 * Two rules keep it honest:
 *
 *   1. **Photo-bearing only.** Someone without a portrait is not shown as an
 *      empty portrait. Sorting them to the back was tried and still put grey
 *      tiles inside the cap on 16 of 23 titles.
 *   2. **One per role before any role repeats**, so three credited writers
 *      cannot take the slots owed to the cinematographer and the composer.
 *
 * TV seeds from `created_by`, which the page already fetches and rendered as
 * plain text: series-level credits carry no Director and no cinematographer
 * (TMDB attaches those per episode), but the creator is the real authorial
 * credit and measured 18/18 for photos.
 */
export function keyCrew(
  crew?: CrewMember[],
  createdBy?: { id: number; name: string; profile_path?: string | null }[],
  max = 6,
): KeyCrewMember[] {
  type Candidate = KeyCrewMember & { rank: number };
  const pool = new Map<number, Candidate>();

  const consider = (
    id: number | undefined,
    name: string | undefined,
    job: string,
    rank: number,
    profilePath: string | null | undefined,
  ) => {
    if (!id || !name || !profilePath) return;
    const prev = pool.get(id);
    // One person, their most senior credit. A writer-director is a director.
    if (!prev || rank < prev.rank) pool.set(id, { id, name, job, rank, profile_path: profilePath });
  };

  // Rank -1: a creator outranks everything, and is the only credit that makes
  // a TV row mean anything.
  for (const c of createdBy ?? []) consider(c.id, c.name, "Creator", -1, c.profile_path);
  for (const m of crew ?? []) {
    const rank = JOB_RANK.indexOf(m.job ?? "");
    if (rank >= 0) consider(m.id, m.name, m.job as string, rank, m.profile_path);
  }

  const ranked = [...pool.values()].sort((a, b) => a.rank - b.rank);

  const picked: Candidate[] = [];
  const rolesTaken = new Set<number>();
  for (const p of ranked) {
    if (rolesTaken.has(p.rank)) continue;
    rolesTaken.add(p.rank);
    picked.push(p);
  }
  // Then backfill with the repeats — a second writer is worth a tile once every
  // distinct role already has one.
  for (const p of ranked) {
    if (picked.length >= max) break;
    if (!picked.includes(p)) picked.push(p);
  }

  const out = picked.slice(0, max).map(({ id, name, job, profile_path }) => ({ id, name, job, profile_path }));
  // A single tile reads as a rendering accident rather than a row.
  return out.length >= 2 ? out : [];
}

/**
 * Who made it, with every name a way through to their other work.
 *
 * Body only — the caller wraps this in its own page's `Section`, because that
 * helper is duplicated in the movie and TV clients and extracting it is a
 * separate refactor. Rendering a heading here would compete with theirs.
 */
export default function CrewBlock({
  groups,
  keyPeople = [],
}: {
  groups: CrewGroup[];
  /** Named `keyPeople`, not `key` — that one is spoken for. */
  keyPeople?: KeyCrewMember[];
}) {
  if (groups.length === 0 && keyPeople.length === 0) return null;

  return (
    <div className="space-y-5">
      {keyPeople.length > 0 && (
        // A scroller, not a grid: six w-32 tiles need 848px and the column is
        // 880px at the container cap but 629px at exactly 1024px, where the
        // three-column text grid first appears. It also makes this strip rhyme
        // with the Cast strip sitting directly above it in the same column.
        <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
          {keyPeople.map((person) => (
            <Link
              key={person.id}
              href={personPath(person.id, person.name)}
              className="group w-28 shrink-0 sm:w-32"
            >
              <div className="aspect-[2/3] w-full overflow-hidden rounded-xl bg-surface-800 ring-1 ring-surface-700/50 transition-all group-hover:ring-brand-500/40">
                <img
                  src={`https://image.tmdb.org/t/p/w342${person.profile_path}`}
                  alt={person.name}
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <p className="mt-2 line-clamp-1 text-sm font-medium text-surface-200 transition-colors group-hover:text-white">
                {person.name}
              </p>
              {/* The job that earned the tile, not the merged list — a director
                  whose subtitle reads "Producer, Writer" because that is TMDB's
                  array order is worse than no subtitle. */}
              <p className="line-clamp-1 text-xs text-surface-500">{person.job}</p>
            </Link>
          ))}
        </div>
      )}

      {groups.map((group) => (
        <div key={group.department}>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-surface-500">
            {group.department}
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            {group.people.map((person) => (
              // Keyed on department + id: the same person legitimately appears
              // in two departments (writer and director), and id alone would
              // collide across groups.
              <div key={`${group.department}:${person.id}`} className="min-w-0">
                <Link
                  href={personPath(person.id, person.name)}
                  className="block truncate text-sm text-surface-200 transition-colors hover:text-brand-400"
                >
                  {person.name}
                </Link>
                {person.jobs.length > 0 && (
                  <p className="truncate text-xs text-surface-500">{person.jobs.join(", ")}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
