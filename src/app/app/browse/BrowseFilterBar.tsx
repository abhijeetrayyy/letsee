"use client";

import Link from "@components/ui/AppLink";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { X } from "lucide-react";
import {
  buildBrowseUrl,
  withBrowseFilters,
  BROWSE_SORTS,
  type BrowseParams,
  type BrowseFilterKey,
} from "@/utils/browseUrl";
import { genresFor, LANGUAGES, DECADES, SORT_LABELS } from "@/staticData/browseFilters";

export type Chip = { key: BrowseFilterKey; label: string; removeUrl: string };

const SELECT_CLASS =
  "min-w-[140px] rounded-lg bg-surface-800 border border-surface-600 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-50";
const LABEL_CLASS = "block text-xs font-medium text-surface-500 mb-1";

/**
 * The filter bar — the whole of D3's interaction surface.
 *
 * It holds no state of its own. Every control reads from `params` and writes a
 * URL, which is the only reason the back button works: there is nothing for a
 * restored history entry to disagree with. A `useState` copy of any filter
 * value would drift from the URL the first time someone pressed Back, and the
 * bar would show one thing while the grid showed another.
 *
 * `params` arrives as a prop rather than from `useSearchParams` on purpose.
 * That hook forces a prerender bailout, and this component sits in the page
 * header outside the Suspense boundary that would otherwise be required.
 *
 * Native `<select>`s, matching all 14 other select sites in this codebase.
 * There is no Select primitive in `components/ui`, and a bespoke popover here
 * would be the only one in the app.
 */
export default function BrowseFilterBar({
  params,
  chips,
}: {
  params: BrowseParams;
  chips: Chip[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Every write goes through `withBrowseFilters`, which is what makes "adding
  // or removing a filter never loses the others" structural rather than a rule
  // each call site has to remember.
  const go = (patch: Partial<BrowseParams>) => {
    startTransition(() => router.push(buildBrowseUrl(withBrowseFilters(params, patch))));
  };

  // A collection is films and a network is TV; offering a toggle that silently
  // refuses would be worse than not offering one.
  const typeIsPinned = Boolean(params.collection || params.network);
  const genres = genresFor(params.type);

  return (
    <div className={isPending ? "opacity-60 transition-opacity" : "transition-opacity"}>
      <div className="flex flex-wrap items-end gap-3">
        {!typeIsPinned && (
          <div>
            <span className={LABEL_CLASS}>Show</span>
            <div className="flex gap-2">
              {(["movie", "tv"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  disabled={isPending}
                  onClick={() => go({ type: t })}
                  className={`rounded-full px-4 py-1.5 text-sm ${
                    params.type === t
                      ? "bg-surface-200 text-surface-900"
                      : "bg-surface-800 text-surface-200 hover:bg-surface-700"
                  }`}
                >
                  {t === "tv" ? "TV" : "Movies"}
                </button>
              ))}
            </div>
          </div>
        )}

        <Field id="browse-genre" label="Genre">
          <select
            id="browse-genre"
            className={SELECT_CLASS}
            disabled={isPending}
            value={params.genre ?? ""}
            onChange={(e) => go({ genre: e.target.value || undefined })}
          >
            <option value="">Any genre</option>
            {genres.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </Field>

        <Field id="browse-lang" label="Language">
          <select
            id="browse-lang"
            className={SELECT_CLASS}
            disabled={isPending}
            value={params.lang ?? ""}
            onChange={(e) => go({ lang: e.target.value || undefined })}
          >
            <option value="">Any language</option>
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </Field>

        <Field id="browse-decade" label="Decade">
          <select
            id="browse-decade"
            className={SELECT_CLASS}
            disabled={isPending}
            value={params.decade ?? ""}
            onChange={(e) => go({ decade: e.target.value || undefined })}
          >
            <option value="">Any decade</option>
            {DECADES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </Field>

        {/* A collection reads in release order and nothing else; a sort control
            over nine Star Wars films is a control with no good answer. */}
        {!params.collection && (
          <Field id="browse-sort" label="Sort">
            <select
              id="browse-sort"
              className={SELECT_CLASS}
              disabled={isPending}
              value={params.sort}
              onChange={(e) => go({ sort: e.target.value as BrowseParams["sort"] })}
            >
              {BROWSE_SORTS.map((s) => (
                <option key={s} value={s}>
                  {SORT_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>

      {chips.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <Link
              key={chip.key}
              href={chip.removeUrl}
              // `scroll={false}` because removing a chip is a refinement of what
              // you are already looking at, not a new destination. Changing a
              // select does scroll to the top, which is correct there: it is a
              // different result set.
              scroll={false}
              className="chip-brand gap-1.5 hover:bg-brand-500/20"
            >
              {chip.label}
              <X className="size-3 opacity-70" aria-hidden />
              <span className="sr-only">Remove filter</span>
            </Link>
          ))}
          {chips.length > 1 && (
            <Link
              href={buildBrowseUrl({ type: params.type })}
              scroll={false}
              className="ml-1 text-xs text-surface-500 underline underline-offset-2 transition-colors hover:text-surface-300"
            >
              Clear all
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      {children}
    </div>
  );
}
