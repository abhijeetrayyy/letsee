import SearchAndFilters from "@components/profile/SearchAndFilters";

/**
 * "Discover people" directory. Data is fetched client-side from
 * /api/users/search, which handles search, browse (empty query), sorting,
 * block filtering, and follow state — and works signed-out.
 */
export default function ProfileListPage() {
  return (
    <div className="min-h-screen w-full bg-surface-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,80,40,0.06),transparent)] pointer-events-none" />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <header className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Discover people
          </h1>
          <p className="mt-1 text-sm text-surface-400">
            Find your cinema soul — browse profiles and connect.
          </p>
        </header>
        <SearchAndFilters />
      </div>
    </div>
  );
}
