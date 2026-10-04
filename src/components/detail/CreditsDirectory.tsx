"use client";

import { useMemo, useState } from "react";
import Link from "@components/ui/AppLink";
import { Search } from "lucide-react";
import Avatar from "@components/ui/Avatar";
import { personPath } from "@/utils/urls";

/**
 * Everyone who made a title (docs/design/PAGES.md, credits): search, then
 * chips by department with counts — Cast first — then one row per person.
 *
 * A person with several jobs in one department is one row ("Director,
 * Writer"), not three. Series rows carry how many episodes each person was in,
 * which is the number that tells a lead from a one-off.
 */
type CreditPerson = {
  id: number;
  name: string;
  profile_path?: string | null;
  character?: string;
  job?: string;
  department?: string;
  episodeCount?: number;
};

type Row = { id: number; name: string; photo: string | null; role: string; episodes: number };

const PAGE = 60;

/** Within a department, the jobs people look for come first; then by episodes, then as TMDB lists them. */
const KEY_JOBS = ["Director", "Creator", "Showrunner", "Writer", "Screenplay", "Story", "Novel", "Executive Producer", "Producer", "Original Music Composer", "Director of Photography", "Editor"];
const jobRank = (role: string) => {
  const ranks = role.split(", ").map((r) => KEY_JOBS.indexOf(r)).filter((i) => i >= 0);
  return ranks.length ? Math.min(...ranks) : KEY_JOBS.length;
};

function rowsFor(people: CreditPerson[], cast: boolean): Row[] {
  const byId = new Map<number, Row & { roles: string[] }>();
  for (const p of people) {
    const role = (cast ? p.character : p.job || p.department)?.trim() || "";
    const row = byId.get(p.id);
    if (row) {
      if (role && !row.roles.includes(role)) row.roles.push(role);
      row.episodes = Math.max(row.episodes, p.episodeCount ?? 0);
    } else {
      byId.set(p.id, { id: p.id, name: p.name, photo: p.profile_path ?? null, role: "", roles: role ? [role] : [], episodes: p.episodeCount ?? 0 });
    }
  }
  const rows = [...byId.values()].map(({ roles, ...r }) => ({ ...r, role: roles.join(", ") }));
  if (cast) return rows;
  return rows.map((r, i) => ({ r, i })).sort((a, b) => jobRank(a.r.role) - jobRank(b.r.role) || b.r.episodes - a.r.episodes || a.i - b.i).map(({ r }) => r);
}

export default function CreditsDirectory({ cast = [], crew = [] }: { cast?: CreditPerson[]; crew?: CreditPerson[] }) {
  const groups = useMemo(() => {
    const out: { key: string; label: string; rows: Row[] }[] = [];
    if (cast.length) out.push({ key: "cast", label: "Cast", rows: rowsFor(cast, true) });
    const departments = new Map<string, CreditPerson[]>();
    for (const p of crew) {
      const d = p.department || "Crew";
      departments.set(d, [...(departments.get(d) ?? []), p]);
    }
    // Directing and Writing first: they're who people look for; the rest by size.
    const order = (d: string) => (d === "Directing" ? 0 : d === "Writing" ? 1 : 2);
    for (const [d, list] of [...departments.entries()].sort((a, b) => order(a[0]) - order(b[0]) || b[1].length - a[1].length)) {
      out.push({ key: d, label: d, rows: rowsFor(list, false) });
    }
    return out;
  }, [cast, crew]);

  const [active, setActive] = useState(groups[0]?.key ?? "cast");
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);

  const q = query.trim().toLowerCase();
  // Searching looks across everyone, not just the open chip.
  const rows = useMemo(() => {
    if (!q) return groups.find((g) => g.key === active)?.rows ?? [];
    const seen = new Set<string>();
    return groups
      .flatMap((g) => g.rows.map((r) => ({ ...r, role: g.key === "cast" ? r.role : r.role || g.label })))
      .filter((r) => [r.name, r.role].some((v) => v.toLowerCase().includes(q)))
      .filter((r) => {
        const k = `${r.id}:${r.role}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
  }, [groups, active, q]);
  const visible = rows.slice(0, shown);

  if (!groups.length) {
    return <p className="mx-auto w-full max-w-app px-4 py-10 text-sm text-ink-500 sm:px-6">TMDB lists no credits for this yet.</p>;
  }

  const chip = (on: boolean) =>
    `inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors ${
      on ? "bg-action text-on-action" : "text-ink-300 ring-1 ring-inset ring-line-input hover:bg-hover hover:text-ink-0"
    }`;

  return (
    <section aria-label="Credits" className="mx-auto flex w-full max-w-app flex-col gap-4 px-4 pb-16 pt-6 sm:px-6">
      <label className="relative block sm:max-w-sheet">
        <span className="sr-only">Search the credits</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-500" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShown(PAGE);
          }}
          placeholder="Search by name or role"
          className="h-11 w-full rounded-control bg-raised pl-9 pr-3 text-base text-ink-0 ring-1 ring-inset ring-line-input placeholder:text-ink-500 focus:outline-none focus:ring-focus"
        />
      </label>

      {!q && groups.length > 1 && (
        <nav aria-label="Departments" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
          {groups.map((g) => (
            <button
              key={g.key}
              type="button"
              aria-pressed={active === g.key}
              onClick={() => {
                setActive(g.key);
                setShown(PAGE);
              }}
              className={chip(active === g.key)}
            >
              {g.label}
              <span className={`font-mono text-xs tabular-nums ${active === g.key ? "text-on-action" : "text-ink-500"}`}>{g.rows.length}</span>
            </button>
          ))}
        </nav>
      )}

      {q && <p className="text-sm text-ink-500">{rows.length === 0 ? "Nobody in the credits matches that." : `${rows.length} ${rows.length === 1 ? "match" : "matches"}`}</p>}

      {visible.length > 0 && (
        <ul className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
          {visible.map((r) => (
            <li key={`${r.id}:${r.role}`}>
              <Link href={personPath(r.id, r.name)} className="flex min-h-14 items-center gap-3 border-b border-line py-2 transition-colors hover:bg-hover">
                <Avatar src={r.photo ? `https://image.tmdb.org/t/p/w185${r.photo}` : null} name={r.name} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink-0">{r.name}</span>
                  {r.role && <span className="block truncate text-sm text-ink-500">{r.role}</span>}
                </span>
                {r.episodes > 0 && (
                  <span className="shrink-0 font-mono text-xs tabular-nums text-ink-500">
                    {r.episodes} ep{r.episodes === 1 ? "" : "s"}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {rows.length > visible.length && (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE)}
          className="inline-flex h-10 w-full items-center justify-center rounded-full text-sm font-medium text-ink-200 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover hover:text-ink-0 sm:w-auto sm:self-center sm:px-6"
        >
          Showing {visible.length} of {rows.length} · More
        </button>
      )}
    </section>
  );
}
