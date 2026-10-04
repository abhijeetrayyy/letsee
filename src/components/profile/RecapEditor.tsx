"use client";

import { RotateCcw } from "lucide-react";
import { getPosterUrl } from "@/utils/imageUrl";
import { cleanLine, MAX_LINE, MAX_POSTERS, shows, startEdits, toggleSection, togglePoster, type RecapEdits } from "@/lib/people/recapEdits";

/**
 * Edit before you share (docs/design/PAGES.md §6): a line of your own, which
 * four posters, which parts of the card show. Changes the card in place and
 * the image it saves; nothing is stored.
 */
export default function RecapEditor({
  pool,
  edits,
  onChange,
  sections,
}: {
  pool: { itemId: string; itemType: string; itemName: string; imageUrl: string | null }[];
  edits: RecapEdits;
  onChange: (next: RecapEdits) => void;
  sections: { key: string; label: string }[];
}) {
  const full = edits.posters.length >= MAX_POSTERS;
  const chip = (on: boolean) =>
    `inline-flex h-9 items-center rounded-full px-3.5 text-sm font-medium transition-colors ${on ? "bg-action text-on-action" : "text-ink-400 ring-1 ring-inset ring-line-input hover:bg-hover hover:text-ink-0"}`;

  return (
    <section aria-label="Edit before you share" className="flex max-w-read flex-col gap-6 rounded-card border border-line-strong bg-raised p-5">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink-0">A line of your own</span>
        <input
          value={edits.line}
          onChange={(e) => onChange({ ...edits, line: cleanLine(e.target.value) })}
          maxLength={MAX_LINE}
          placeholder="The year I finally watched everything Kurosawa made"
          className="h-11 rounded-control bg-page px-3 text-base text-ink-0 ring-1 ring-inset ring-line-input placeholder:text-ink-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        />
      </label>

      {pool.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink-0">
            Posters <span className="font-normal text-ink-500">· {edits.posters.length} of {MAX_POSTERS}{full ? " — take one off to swap" : ""}</span>
          </legend>
          <ul className="grid grid-cols-6 gap-2">
            {pool.map((f) => {
              const key = `${f.itemType}:${f.itemId}`;
              const at = edits.posters.indexOf(key);
              const on = at >= 0;
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => onChange(togglePoster(edits, key))}
                    aria-pressed={on}
                    aria-label={`${f.itemName}${on ? `, poster ${at + 1}` : ""}`}
                    disabled={!on && full}
                    className={`relative block w-full overflow-hidden rounded-media transition-opacity disabled:opacity-40 ${on ? "ring-2 ring-action" : "opacity-70 hover:opacity-100"}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={getPosterUrl(f.imageUrl, "w92")} alt="" className="aspect-2/3 w-full object-cover" />
                    {on && <span className="absolute left-1 top-1 flex size-5 items-center justify-center rounded-full bg-action font-mono text-xs text-on-action">{at + 1}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </fieldset>
      )}

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink-0">On the card</legend>
        <div className="flex flex-wrap gap-2">
          {sections.map((s) => (
            <button key={s.key} type="button" aria-pressed={shows(edits, s.key)} onClick={() => onChange(toggleSection(edits, s.key))} className={chip(shows(edits, s.key))}>
              {s.label}
            </button>
          ))}
        </div>
      </fieldset>

      <button
        type="button"
        onClick={() => onChange(startEdits(pool.map((f) => `${f.itemType}:${f.itemId}`)))}
        className="inline-flex items-center gap-1.5 self-start text-sm text-ink-500 hover:text-ink-0"
      >
        <RotateCcw className="size-4" aria-hidden />
        Start over
      </button>
    </section>
  );
}
