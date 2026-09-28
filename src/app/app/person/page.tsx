import Link from "@components/ui/AppLink";
import type { Metadata } from "next";
import { Search, UserRound } from "lucide-react";
import { tmdbFetchJson } from "@/utils/tmdb";
import { personPath } from "@/utils/urls";

/** On the page so `/app/person/[id]` cannot inherit it. */
export const metadata: Metadata = {
  alternates: { canonical: "/app/person" },
};

export const revalidate = 86400;

type PopularPerson = {
  id: number;
  name: string;
  profile_path?: string | null;
  known_for_department?: string;
  known_for?: { title?: string; name?: string }[];
};

async function getPopularPeople(): Promise<PopularPerson[]> {
  const { data } = await tmdbFetchJson<{ results?: PopularPerson[] }>(
    `https://api.themoviedb.org/3/person/popular?api_key=${process.env.TMDB_API_KEY}&language=en-US&page=1`,
    "Popular people",
    { revalidate: 86400 },
  );
  return (data?.results ?? []).slice(0, 12);
}

export default async function PersonIndexPage() {
  const people = await getPopularPeople();

  return (
    <main className="min-h-screen bg-surface-950 text-surface-200">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <header className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-400">People</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">Find actors and filmmakers</h1>
          <p className="mt-2 text-sm text-surface-400">
            Search a name, explore their work, and see how much of it you have watched.
          </p>
        </header>

        <form action="/app/search" className="relative mt-6 max-w-xl">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-surface-500" />
          <input
            name="q"
            type="search"
            required
            minLength={2}
            placeholder="Search a person by name"
            className="min-h-12 w-full rounded-full border border-surface-700 bg-surface-900 pl-11 pr-28 text-sm text-white outline-none placeholder:text-surface-600 focus:border-brand-500/50"
          />
          <button type="submit" className="absolute right-1.5 top-1/2 min-h-9 -translate-y-1/2 rounded-full bg-brand-500 px-4 text-sm font-semibold text-surface-950 hover:bg-brand-400">
            Search
          </button>
        </form>

        {people.length > 0 && (
          <section className="mt-12">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-bold text-white">Popular now</h2>
              <Link href="/app/search" className="text-sm text-brand-400 hover:text-brand-300">Search everyone →</Link>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {people.map((person) => (
                <Link key={person.id} href={personPath(person.id, person.name)} className="group min-w-0">
                  <div className="aspect-[2/3] overflow-hidden rounded-xl bg-surface-800 ring-1 ring-surface-700/60 transition-colors group-hover:ring-brand-500/50">
                    {person.profile_path ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`https://image.tmdb.org/t/p/w342${person.profile_path}`} alt="" loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="flex size-full items-center justify-center"><UserRound className="size-8 text-surface-600" /></div>
                    )}
                  </div>
                  <h3 className="mt-2 truncate text-sm font-semibold text-surface-100 group-hover:text-white">{person.name}</h3>
                  <p className="truncate text-xs text-surface-500">
                    {person.known_for?.slice(0, 2).map((item) => item.title || item.name).filter(Boolean).join(" · ") || person.known_for_department || "Person"}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="mt-12 border-t border-surface-800 pt-5">
          <Link href="/app" className="text-sm text-surface-500 hover:text-brand-400">← Back to Home</Link>
        </div>
      </div>
    </main>
  );
}
