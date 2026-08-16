"use client";

import { useState } from "react";
import useSWR from "swr";
import { Check, Globe, Loader2, Lock, PencilLine, Trash2 } from "lucide-react";
import { swrFetcher } from "@/utils/swrFetcher";
import { getAvatarUrl } from "@/utils/imageUrl";
import StarRating from "@components/ui/StarRating";
import { formatStars } from "@/utils/ratingScale";

type Take = { score: number | null; body: string; isPublic: boolean; updatedAt: string | null };
type Other = {
  username: string;
  avatarUrl: string | null;
  score: number | null;
  body: string;
  updatedAt: string;
};

type Props = {
  itemId: string;
  itemType: "movie" | "tv";
  scope?: "title" | "season" | "episode";
  seasonNumber?: number;
  episodeNumber?: number;
  /** Only used to keep the legacy mirror's metadata populated. */
  itemName?: string;
  imageUrl?: string | null;
  genres?: string[];
  isAuthenticated: boolean;
};

/**
 * One place to say what you thought.
 *
 * This replaces four separate surfaces — a rating widget, a diary box, a
 * public-review box and the community list — that between them made a person
 * decide *where* to put an opinion before they could have one.
 *
 * The important part is not that they're now adjacent. It's that the rating
 * and the writing are **one save**, and public-versus-private is **one
 * toggle on one text** rather than two fields the interface has to explain.
 * Scattering was the symptom; two columns for the same sentence was the cause.
 *
 * The same component serves a film, a season and an episode — only `scope`
 * changes — which is what lets a season take exist at all.
 */
export default function YourTake({
  itemId,
  itemType,
  scope = "title",
  seasonNumber,
  episodeNumber,
  itemName,
  imageUrl,
  genres,
  isAuthenticated,
}: Props) {
  const qs = new URLSearchParams({ itemId, itemType, scope });
  if (seasonNumber != null) qs.set("seasonNumber", String(seasonNumber));
  if (episodeNumber != null) qs.set("episodeNumber", String(episodeNumber));
  const key = `/api/takes?${qs.toString()}`;

  const { data, mutate, isLoading } = useSWR<{
    mine: Take | null;
    privateNote: Take | null;
    others: Other[];
  }>(key, swrFetcher);

  const mine = data?.mine ?? null;
  const others = data?.others ?? [];

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const noun = scope === "season" ? "this season" : scope === "episode" ? "this episode" : "this";

  const open = () => {
    setDraft(mine?.body ?? "");
    setScore(mine?.score ?? null);
    setIsPublic(mine?.isPublic ?? false);
    setEditing(true);
    setError(null);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/takes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId,
          itemType,
          scope,
          seasonNumber,
          episodeNumber,
          score,
          body: draft,
          isPublic,
          itemName,
          imageUrl,
          genres,
        }),
      });
      if (!res.ok) throw new Error((await res.json())?.error ?? "Couldn't save");
      await mutate();
      setEditing(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      const del = new URLSearchParams(qs);
      del.set("isPublic", String(mine?.isPublic ?? false));
      await fetch(`/api/takes?${del.toString()}`, { method: "DELETE" });
      await mutate();
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-surface-500">
        <Loader2 className="size-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <section className="card-accent rounded-2xl p-5">
      <div className="flex items-center gap-3">
        <div className="h-6 w-1 shrink-0 rounded-full bg-brand-500" />
        <h3 className="text-sm font-semibold text-surface-200">Your take</h3>
      </div>

      {!isAuthenticated ? (
        <p className="mt-3 text-sm text-surface-500">Sign in to rate or write about {noun}.</p>
      ) : editing ? (
        <div className="mt-4 space-y-3">
          {/* Rating and writing are one act with one save. Splitting them is
              what made people wonder whether they'd finished. */}
          <StarRating value={score} onChange={setScore} size="lg" label={itemName} />

          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={5}
            maxLength={5000}
            placeholder={`What did you make of ${noun}?`}
            className="w-full resize-y rounded-xl border border-surface-700 bg-surface-950 px-3.5 py-3 text-sm text-white placeholder-surface-600 focus:border-brand-500 focus:outline-none"
          />

          <div className="flex flex-wrap items-center gap-3">
            {/* One toggle on one text — not two boxes to choose between. */}
            <button
              type="button"
              onClick={() => setIsPublic((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full border border-surface-700 px-3 py-1.5 text-xs text-surface-300 transition hover:border-surface-600 hover:text-white"
            >
              {isPublic ? (
                <><Globe className="size-3.5 text-brand-400" /> Anyone can read this</>
              ) : (
                <><Lock className="size-3.5" /> Just for me</>
              )}
            </button>

            {mine && (
              <button
                type="button"
                onClick={remove}
                disabled={saving}
                className="inline-flex items-center gap-1 text-xs text-surface-500 transition hover:text-rose-400 disabled:opacity-50"
              >
                <Trash2 className="size-3.5" /> Remove
              </button>
            )}

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="text-sm text-surface-500 transition hover:text-surface-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="btn-primary px-4 py-2 text-sm disabled:opacity-60"
              >
                {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                Save
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-rose-400">{error}</p>}
        </div>
      ) : (
        <div className="mt-4">
          {mine ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                {mine.score != null && (
                  <span className="inline-flex items-center gap-2">
                    <StarRating value={mine.score} size="md" />
                    <span className="text-sm font-semibold text-accent-gold">
                      {formatStars(mine.score)}
                    </span>
                  </span>
                )}
                <span className="inline-flex items-center gap-1 text-xs text-surface-500">
                  {mine.isPublic ? (
                    <><Globe className="size-3.5 text-brand-400" /> Public</>
                  ) : (
                    <><Lock className="size-3.5" /> Just for you</>
                  )}
                </span>
              </div>
              {mine.body && (
                <p className="mt-3 whitespace-pre-wrap text-sm text-surface-200">{mine.body}</p>
              )}
            </>
          ) : (
            <p className="text-sm text-surface-500">
              You haven&apos;t rated or written about {noun} yet.
            </p>
          )}

          <button
            type="button"
            onClick={open}
            className="mt-3 inline-flex items-center gap-1.5 text-sm text-brand-400 transition hover:text-brand-300"
          >
            <PencilLine className="size-3.5" />
            {mine ? "Edit" : "Rate or write something"}
          </button>

          {/* Someone can hold a public review and a private note at once — see
              065. Showing the note here rather than hiding it is the whole
              point of "one place". */}
          {data?.privateNote?.body && (
            <div className="mt-4 rounded-xl border border-surface-800 bg-surface-900/40 p-3">
              <p className="inline-flex items-center gap-1 text-xs text-surface-500">
                <Lock className="size-3.5" /> You also kept a private note
              </p>
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-surface-300">
                {data.privateNote.body}
              </p>
            </div>
          )}
        </div>
      )}

      {others.length > 0 && (
        <div className="mt-6 border-t border-surface-800 pt-4">
          <h4 className="text-xs font-semibold uppercase tracking-[0.15em] text-surface-500">
            What others said
          </h4>
          <ul className="mt-3 space-y-4">
            {others.map((o) => (
              <li key={`${o.username}-${o.updatedAt}`} className="flex gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getAvatarUrl(o.avatarUrl)}
                  alt=""
                  className="size-8 shrink-0 rounded-full object-cover"
                />
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-white">@{o.username}</span>
                    {o.score != null && <StarRating value={o.score} size="sm" />}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-surface-300">{o.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
