"use client";

import { useState } from "react";
import useSWR from "swr";
import { Check, Loader2, Lock, PencilLine, Globe } from "lucide-react";
import { swrFetcher } from "@/utils/swrFetcher";
import { getAvatarUrl } from "@/utils/imageUrl";

type Mine = {
  score: number | null;
  reviewText: string;
  publicReviewText: string;
  updatedAt: string;
} | null;

type Other = {
  username: string;
  avatarUrl: string | null;
  score: number | null;
  text: string;
  updatedAt: string;
};

/**
 * Writing about a season.
 *
 * The season is the unit people actually argue about — "season 4 is where it
 * turns" — and until now there was nowhere to say that: series reviews are too
 * coarse for a long-running show, episode notes too fine.
 *
 * Keeps the diary/public split the rest of the app uses, and defaults to
 * private. A note to yourself is the common case; publishing is the deliberate
 * one.
 */
export default function SeasonReview({
  showId,
  seasonNumber,
  showName,
  isAuthenticated,
}: {
  showId: string;
  seasonNumber: number;
  showName: string;
  isAuthenticated: boolean;
}) {
  const key = `/api/season-review?showId=${showId}&seasonNumber=${seasonNumber}`;
  const { data, mutate, isLoading } = useSWR<{ mine: Mine; others: Other[] }>(key, swrFetcher);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [score, setScore] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mine = data?.mine ?? null;
  const others = data?.others ?? [];

  const startEditing = () => {
    const existingPublic = mine?.publicReviewText ?? "";
    const existingPrivate = mine?.reviewText ?? "";
    setIsPublic(!!existingPublic);
    setDraft(existingPublic || existingPrivate);
    setScore(mine?.score != null ? String(mine.score) : "");
    setEditing(true);
    setError(null);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/season-review", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          showId,
          seasonNumber,
          showName,
          score: score === "" ? null : Number(score),
          // One field, one destination — writing to both would leave a stale
          // copy of the text in whichever half the user didn't mean.
          reviewText: isPublic ? "" : draft,
          publicReviewText: isPublic ? draft : "",
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

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-surface-500">
        <Loader2 className="size-4 animate-spin" /> Loading reviews…
      </div>
    );
  }

  const myText = mine?.publicReviewText || mine?.reviewText || "";

  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-white">On this season</h2>

      {isAuthenticated ? (
        editing ? (
          <div className="mt-3 rounded-2xl border border-surface-800 bg-surface-900/40 p-4">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={5}
              maxLength={5000}
              placeholder={`What did you make of season ${seasonNumber}?`}
              className="w-full resize-y rounded-xl border border-surface-700 bg-surface-950 px-3.5 py-3 text-sm text-white placeholder-surface-600 focus:border-brand-500 focus:outline-none"
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-surface-400">
                Rating
                <select
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                  className="rounded-lg border border-surface-700 bg-surface-950 px-2.5 py-1.5 text-sm text-white focus:border-brand-500 focus:outline-none"
                >
                  <option value="">—</option>
                  {Array.from({ length: 10 }, (_, i) => 10 - i).map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={() => setIsPublic((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-full border border-surface-700 px-3 py-1.5 text-xs text-surface-300 hover:border-surface-600 hover:text-white transition"
              >
                {isPublic ? <Globe className="size-3.5 text-brand-400" /> : <Lock className="size-3.5" />}
                {isPublic ? "Public" : "Just for me"}
              </button>

              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="text-sm text-surface-500 hover:text-surface-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="btn-primary text-sm px-4 py-2 disabled:opacity-60"
                >
                  {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                  Save
                </button>
              </div>
            </div>
            {error && <p className="mt-2 text-sm text-rose-400">{error}</p>}
          </div>
        ) : (
          <div className="mt-3 rounded-2xl border border-surface-800 bg-surface-900/40 p-4">
            {myText ? (
              <>
                <div className="flex items-center gap-2 text-xs text-surface-500">
                  {mine?.publicReviewText ? (
                    <><Globe className="size-3.5 text-brand-400" /> Public</>
                  ) : (
                    <><Lock className="size-3.5" /> Just for you</>
                  )}
                  {mine?.score != null && (
                    <span className="ml-1 rounded-full bg-surface-800 px-2 py-0.5 text-surface-300">
                      {mine.score}/10
                    </span>
                  )}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-surface-200">{myText}</p>
              </>
            ) : (
              <p className="text-sm text-surface-500">
                No thoughts on season {seasonNumber} yet.
              </p>
            )}
            <button
              type="button"
              onClick={startEditing}
              className="mt-3 inline-flex items-center gap-1.5 text-sm text-brand-400 hover:text-brand-300 transition"
            >
              <PencilLine className="size-3.5" />
              {myText ? "Edit" : "Write something"}
            </button>
          </div>
        )
      ) : (
        <p className="mt-3 text-sm text-surface-500">Sign in to write about this season.</p>
      )}

      {others.length > 0 && (
        <ul className="mt-5 space-y-4">
          {others.map((o) => (
            <li key={`${o.username}-${o.updatedAt}`} className="flex gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getAvatarUrl(o.avatarUrl)}
                alt=""
                className="size-8 shrink-0 rounded-full object-cover"
              />
              <div className="min-w-0">
                <p className="text-sm">
                  <span className="font-medium text-white">@{o.username}</span>
                  {o.score != null && (
                    <span className="ml-2 text-xs text-surface-500">{o.score}/10</span>
                  )}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-surface-300">{o.text}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
