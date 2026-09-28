"use client";

import { useMemo, useState } from "react";
import Link from "@components/ui/AppLink";
import { Search, Users } from "lucide-react";
import { personPath } from "@/utils/urls";

type CreditPerson = {
  id: number;
  name: string;
  profile_path?: string | null;
  character?: string;
  job?: string;
  department?: string;
  episodeCount?: number;
};

type Tab = "cast" | "crew";
const PAGE_SIZE = 60;

function PersonRow({ person, tab }: { person: CreditPerson; tab: Tab }) {
  const role = tab === "cast" ? person.character : person.job || person.department;
  return (
    <Link
      href={personPath(person.id, person.name)}
      className="group flex min-w-0 items-center gap-3 rounded-xl border border-surface-800/70 bg-surface-900/40 p-2.5 transition-colors hover:border-brand-500/40 hover:bg-surface-800/60"
    >
      <span className="flex size-14 shrink-0 overflow-hidden rounded-lg bg-surface-800">
        {person.profile_path ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`https://image.tmdb.org/t/p/w185${person.profile_path}`}
            alt=""
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <Users className="m-auto size-5 text-surface-600" />
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-surface-100 group-hover:text-white">{person.name}</span>
        {role && <span className="block truncate text-xs text-surface-400">{role}</span>}
        {!!person.episodeCount && (
          <span className="mt-0.5 block text-[11px] tabular-nums text-surface-500">
            {person.episodeCount} episode{person.episodeCount === 1 ? "" : "s"}
          </span>
        )}
      </span>
    </Link>
  );
}

export default function CreditsDirectory({ cast = [], crew = [] }: { cast?: CreditPerson[]; crew?: CreditPerson[] }) {
  const [tab, setTab] = useState<Tab>(cast.length ? "cast" : "crew");
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("all");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const departments = useMemo(
    () => Array.from(new Set(crew.map((person) => person.department).filter(Boolean) as string[])).sort(),
    [crew],
  );

  const source = tab === "cast" ? cast : crew;
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return source.filter((person) => {
      if (tab === "crew" && department !== "all" && person.department !== department) return false;
      if (!needle) return true;
      return [person.name, person.character, person.job, person.department]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(needle));
    });
  }, [department, query, source, tab]);

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-4 border-b border-surface-800 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex gap-1 rounded-xl bg-surface-900 p-1" role="tablist" aria-label="Credit type">
            {(["cast", "crew"] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                onClick={() => { setTab(value); setVisible(PAGE_SIZE); }}
                className={`min-h-10 rounded-lg px-4 text-sm font-medium transition-colors ${tab === value ? "bg-surface-700 text-white" : "text-surface-400 hover:text-white"}`}
              >
                {value === "cast" ? "Cast" : "Crew"} <span className="ml-1 text-surface-500">{value === "cast" ? cast.length : crew.length}</span>
              </button>
            ))}
          </div>
        </div>

        <label className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-surface-700 bg-surface-900 px-3 focus-within:border-brand-500/50 sm:max-w-sm">
          <Search className="size-4 shrink-0 text-surface-500" />
          <span className="sr-only">Search credits</span>
          <input
            value={query}
            onChange={(event) => { setQuery(event.target.value); setVisible(PAGE_SIZE); }}
            placeholder={`Search ${tab} by name or role`}
            className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-surface-600"
          />
        </label>
      </div>

      {tab === "crew" && departments.length > 1 && (
        <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="Crew department">
          {["all", ...departments].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => { setDepartment(value); setVisible(PAGE_SIZE); }}
              className={`min-h-9 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors ${department === value ? "border-brand-500/40 bg-brand-500/15 text-brand-300" : "border-surface-700 text-surface-400 hover:text-white"}`}
            >
              {value === "all" ? "All departments" : value}
            </button>
          ))}
        </div>
      )}

      <div className="mt-5 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold text-white">{tab === "cast" ? "Cast" : "Crew"}</h2>
        <p className="text-xs tabular-nums text-surface-500">{filtered.length} result{filtered.length === 1 ? "" : "s"}</p>
      </div>

      {filtered.length ? (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.slice(0, visible).map((person, index) => (
              <PersonRow key={`${tab}-${person.id}-${person.job ?? person.character ?? index}`} person={person} tab={tab} />
            ))}
          </div>
          {visible < filtered.length && (
            <button
              type="button"
              onClick={() => setVisible((count) => count + PAGE_SIZE)}
              className="mx-auto mt-7 block min-h-11 rounded-full border border-surface-700 bg-surface-900 px-5 text-sm font-medium text-surface-200 hover:border-brand-500/40 hover:text-white"
            >
              Show {Math.min(PAGE_SIZE, filtered.length - visible)} more
            </button>
          )}
        </>
      ) : (
        <div className="mt-6 rounded-xl border border-dashed border-surface-700 px-5 py-12 text-center">
          <p className="font-medium text-surface-300">No matching credits</p>
          <p className="mt-1 text-sm text-surface-500">Try another name, role, or department.</p>
        </div>
      )}
    </section>
  );
}
