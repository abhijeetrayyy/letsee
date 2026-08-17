import Link from "next/link";
import type { Credit } from "@/utils/person/model";

/**
 * The honest disclosure of what the classifier set aside.
 *
 * Demoted, never deleted — people genuinely do look up "was he on Graham
 * Norton". A native <details> so the disclosure costs no JavaScript and gets
 * correct aria-expanded for free.
 *
 * No posters, on purpose. Making the demotion visible in the rendering is the
 * point, and it keeps ~340 images and ~340 context subscribers off a route
 * where they would buy nothing.
 */
export default function AsThemselves({ credits }: { credits: Credit[] }) {
  const rows = credits
    .filter((c) => c.bucket === "appearance" || c.bucket === "archive")
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  if (rows.length === 0) return null;

  return (
    <details className="rounded-2xl border border-surface-800 bg-surface-900/40 px-4 py-3">
      <summary className="cursor-pointer list-none text-sm text-surface-300 transition hover:text-white">
        As themselves
        <span className="text-surface-500"> — {rows.length} appearance{rows.length === 1 ? "" : "s"} · talk shows, awards nights and archive footage</span>
      </summary>
      <ul className="mt-3 grid gap-x-8 gap-y-1 sm:grid-cols-2">
        {rows.map((c) => (
          <li key={c.key} className="flex gap-2 py-1 text-xs">
            <span className="w-9 shrink-0 font-mono tabular-nums text-surface-600">{c.year ?? "—"}</span>
            <Link href={`/app/${c.mediaType}/${c.id}`} className="min-w-0 flex-1 truncate text-surface-400 transition hover:text-white">
              {c.title}
              {c.episodeCount > 1 && <span className="text-surface-600"> · {c.episodeCount} eps</span>}
              {c.bucket === "archive" && <span className="text-surface-600"> · archive</span>}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
