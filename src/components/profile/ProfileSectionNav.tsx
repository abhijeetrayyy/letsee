const SECTIONS = [
  ["profile-overview", "Overview"],
  ["profile-favorites", "Favorites"],
  ["profile-activity", "Activity"],
  ["profile-library", "Library"],
  ["profile-reviews", "Reviews"],
  ["profile-lists", "Lists"],
  ["profile-stats", "Stats"],
] as const;

/** A compact table of contents for profiles that can otherwise run for many screens. */
export default function ProfileSectionNav() {
  return (
    <nav
      aria-label="Profile sections"
      className="sticky top-16 z-20 -mx-4 overflow-x-auto border-y border-surface-800/70 bg-surface-950/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6"
    >
      <div className="no-scrollbar flex min-w-max gap-1">
        {SECTIONS.map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="inline-flex min-h-9 items-center rounded-full px-3 text-xs font-medium text-surface-400 transition-colors hover:bg-surface-800 hover:text-white focus-visible:text-white"
          >
            {label}
          </a>
        ))}
      </div>
    </nav>
  );
}
