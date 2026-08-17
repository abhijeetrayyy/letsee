import Link from "next/link";

export type CrewMember = {
  id: number;
  name: string;
  job?: string;
  department?: string;
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
 * Who made it, with every name a way through to their other work.
 *
 * Body only — the caller wraps this in its own page's `Section`, because that
 * helper is duplicated in the movie and TV clients and extracting it is a
 * separate refactor. Rendering a heading here would compete with theirs.
 */
export default function CrewBlock({ groups }: { groups: CrewGroup[] }) {
  if (groups.length === 0) return null;

  return (
    <div className="space-y-5">
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
                  href={`/app/person/${person.id}`}
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
