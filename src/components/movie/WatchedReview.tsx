"use client";

import React, { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

interface WatchedReviewProps {
  itemId: number | string;
  itemType: "movie" | "tv";
  isWatched?: boolean;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

type Fetched = {
  diaryText: string | null;
  publicReviewText: string | null;
  watchedAt: string | null;
};

function doFetch(itemId: string, itemType: string): Promise<Fetched | null> {
  const params = new URLSearchParams({ itemId, itemType });
  return fetch(`/api/watched-review?${params}`, { credentials: "include" }).then((res) => {
    if (res.status === 401 || res.status === 404) return null;
    return res.json().then((body) =>
      body?.error
        ? null
        : {
            diaryText: body?.diaryText ?? null,
            publicReviewText: body?.publicReviewText ?? null,
            watchedAt: body?.watchedAt ?? null,
          }
    );
  });
}

export default function WatchedReview({ itemId, itemType, isWatched }: WatchedReviewProps) {
  const [diaryText, setDiaryText] = useState<string | null>(null);
  const [publicReviewText, setPublicReviewText] = useState<string | null>(null);
  const [watchedAt, setWatchedAt] = useState<string | null>(null);
  const [editDiary, setEditDiary] = useState("");
  const [editPublicReview, setEditPublicReview] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingDiary, setSavingDiary] = useState(false);
  const [savingPublic, setSavingPublic] = useState(false);
  const [savedDiary, setSavedDiary] = useState(false);
  const [savedPublic, setSavedPublic] = useState(false);
  const [editingDiary, setEditingDiary] = useState(false);
  const [editingPublicReview, setEditingPublicReview] = useState(false);
  const [deletingDiary, setDeletingDiary] = useState(false);
  const [deletingPublic, setDeletingPublic] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loggedOut, setLoggedOut] = useState(false);
  const [notWatched, setNotWatched] = useState(false);
  const retryRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setLoggedOut(false);
    setNotWatched(false);
    retryRef.current = false;
    setLoading(true);

    const fetchOne = () =>
      doFetch(String(itemId), itemType).then((data) => {
        if (cancelled) return;
        if (data === null) {
          setNotWatched(true);
          setLoading(false);
          const check401 = async () => {
            const p = new URLSearchParams({ itemId: String(itemId), itemType });
            const r = await fetch(`/api/watched-review?${p}`, { credentials: "include" });
            if (r.status === 401) setLoggedOut(true);
          };
          check401();
          if (!retryRef.current) {
            retryRef.current = true;
            setTimeout(() =>
              doFetch(String(itemId), itemType).then((retryData) => {
                if (!cancelled && retryData) {
                  setDiaryText(retryData.diaryText ?? null);
                  setPublicReviewText(retryData.publicReviewText ?? null);
                  setWatchedAt(retryData.watchedAt ?? null);
                  setEditDiary(retryData.diaryText ?? "");
                  setEditPublicReview(retryData.publicReviewText ?? "");
                  setNotWatched(false);
                }
                setLoading(false);
              })
            , 500);
          }
          return;
        }
        setDiaryText(data.diaryText ?? null);
        setPublicReviewText(data.publicReviewText ?? null);
        setWatchedAt(data.watchedAt ?? null);
        setEditDiary(data.diaryText ?? "");
        setEditPublicReview(data.publicReviewText ?? "");
        setLoading(false);
      });

    fetchOne().catch(() => {
      if (!cancelled) setError("Failed to load");
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [itemId, itemType, isWatched]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const checkHash = () => {
      if (window.location.hash === "#edit-public-review") {
        setEditingPublicReview(true);
        setEditPublicReview((prev) => prev || (publicReviewText ?? ""));
      }
    };
    checkHash();
    window.addEventListener("hashchange", checkHash);
    return () => window.removeEventListener("hashchange", checkHash);
  }, [publicReviewText]);

  const saveDiary = async () => {
    setSavingDiary(true);
    setError(null);
    setSavedDiary(false);
    try {
      const res = await fetch("/api/watched-review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: String(itemId),
          itemType,
          diaryText: editDiary.trim() || null,
        }),
        credentials: "include",
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error || "Failed to save diary");
        return;
      }
      setDiaryText(body?.diaryText ?? null);
      setEditDiary(body?.diaryText ?? "");
      setSavedDiary(true);
      setEditingDiary(false);
      toast.success("Diary saved");
      setTimeout(() => setSavedDiary(false), 2500);
    } catch {
      setError("Failed to save diary");
      toast.error("Failed to save diary");
    } finally {
      setSavingDiary(false);
    }
  };

  const deleteDiary = async () => {
    if (!window.confirm("Delete this diary note?")) return;
    setDeletingDiary(true);
    setError(null);
    try {
      const res = await fetch("/api/watched-review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: String(itemId), itemType, diaryText: null }),
        credentials: "include",
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error || "Failed to delete");
        return;
      }
      setDiaryText(null);
      setEditDiary("");
      setEditingDiary(false);
      toast.success("Diary note deleted");
    } catch {
      setError("Failed to delete diary");
      toast.error("Failed to delete diary");
    } finally {
      setDeletingDiary(false);
    }
  };

  const savePublicReview = async () => {
    setSavingPublic(true);
    setError(null);
    setSavedPublic(false);
    try {
      const res = await fetch("/api/watched-review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: String(itemId),
          itemType,
          publicReviewText: editPublicReview.trim() || null,
        }),
        credentials: "include",
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error || "Failed to save public review");
        return;
      }
      setPublicReviewText(body?.publicReviewText ?? null);
      setEditPublicReview(body?.publicReviewText ?? "");
      setSavedPublic(true);
      setEditingPublicReview(false);
      toast.success("Public review saved");
      setTimeout(() => setSavedPublic(false), 2500);
    } catch {
      setError("Failed to save public review");
      toast.error("Failed to save public review");
    } finally {
      setSavingPublic(false);
    }
  };

  const deletePublicReview = async () => {
    if (!window.confirm("Delete this public review? It will no longer appear in Reviews.")) return;
    setDeletingPublic(true);
    setError(null);
    try {
      const res = await fetch("/api/watched-review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: String(itemId), itemType, publicReviewText: null }),
        credentials: "include",
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error || "Failed to delete");
        return;
      }
      setPublicReviewText(null);
      setEditPublicReview("");
      setEditingPublicReview(false);
      toast.success("Public review deleted");
    } catch {
      setError("Failed to delete public review");
      toast.error("Failed to delete public review");
    } finally {
      setDeletingPublic(false);
    }
  };

  if (loading) {
    return (
      <div className="my-4 text-neutral-400 text-sm">
        Loading…
      </div>
    );
  }

  if (loggedOut) return null;

  if (notWatched) {
    return (
      <div className="my-4 p-4 rounded-lg bg-neutral-800/50 border border-neutral-700">
        <p className="text-neutral-300 text-sm font-medium mb-1">Your diary &amp; public review</p>
        <p className="text-neutral-500 text-sm">
          Mark this as <strong className="text-neutral-400">Watched</strong> (button above) to add private diary notes and optionally publish a public review.
        </p>
      </div>
    );
  }

  return (
    <div className="my-4 space-y-4">
      {error && (
        <p className="text-amber-200 text-sm">{error}</p>
      )}

      {/* Your diary — private: card when saved, form when empty or editing */}
      <section className="rounded-lg border border-neutral-700 bg-neutral-800/50 overflow-hidden">
        <p className="px-4 pt-3 pb-1 text-neutral-300 text-sm font-medium">Your diary</p>
        <p className="px-4 text-neutral-500 text-xs pb-2">Private notes. Only you can see this.</p>
        {diaryText && !editingDiary ? (
          <div className="flex flex-col sm:flex-row sm:items-start gap-3 px-4 pb-4">
            <div className="shrink-0 text-neutral-500 text-xs sm:pt-0.5">
              {watchedAt ? formatDateTime(watchedAt) : ""}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-neutral-200 text-sm whitespace-pre-wrap">{diaryText}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditDiary(diaryText);
                  setEditingDiary(true);
                }}
                className="px-3 py-1.5 text-neutral-300 hover:text-white hover:bg-neutral-600 text-sm font-medium rounded-lg transition"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={deleteDiary}
                disabled={deletingDiary}
                className="px-3 py-1.5 text-red-300 hover:text-red-200 hover:bg-red-900/30 text-sm font-medium rounded-lg transition disabled:opacity-60"
              >
                {deletingDiary ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="px-4 pb-2">
              <textarea
                value={editDiary}
                onChange={(e) => setEditDiary(e.target.value)}
                placeholder="Your private notes..."
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-600 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none text-sm"
              />
            </div>
            <div className="px-4 pb-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={saveDiary}
                disabled={savingDiary}
                className="px-3 py-1.5 bg-neutral-600 hover:bg-neutral-500 text-white text-sm font-medium rounded-lg disabled:opacity-60 transition"
              >
                {savingDiary ? "Saving…" : diaryText ? "Save changes" : "Save diary"}
              </button>
              {diaryText && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingDiary(false);
                    setEditDiary(diaryText);
                  }}
                  className="px-3 py-1.5 text-neutral-400 hover:text-neutral-200 text-sm"
                >
                  Cancel
                </button>
              )}
              {savedDiary && <span className="text-green-400 text-sm font-medium">Saved</span>}
            </div>
          </>
        )}
      </section>

      {/* Your public review — card when saved, form when empty or editing */}
      <section id="your-public-review" className="rounded-lg border border-indigo-900/50 bg-neutral-800/50 overflow-hidden">
        <p className="px-4 pt-3 pb-1 text-neutral-300 text-sm font-medium">Your public review</p>
        <p className="px-4 text-neutral-500 text-xs pb-2">Optional. Visible to everyone in Reviews below.</p>
        {publicReviewText && !editingPublicReview ? (
          <div className="flex flex-col sm:flex-row sm:items-start gap-3 px-4 pb-4">
            <div className="shrink-0 text-neutral-500 text-xs sm:pt-0.5">
              {watchedAt ? formatDateTime(watchedAt) : ""}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-neutral-200 text-sm whitespace-pre-wrap">{publicReviewText}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditPublicReview(publicReviewText);
                  setEditingPublicReview(true);
                }}
                className="px-3 py-1.5 text-neutral-300 hover:text-white hover:bg-neutral-600 text-sm font-medium rounded-lg transition"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={deletePublicReview}
                disabled={deletingPublic}
                className="px-3 py-1.5 text-red-300 hover:text-red-200 hover:bg-red-900/30 text-sm font-medium rounded-lg transition disabled:opacity-60"
              >
                {deletingPublic ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="px-4 pb-2">
              <textarea
                value={editPublicReview}
                onChange={(e) => setEditPublicReview(e.target.value)}
                placeholder="Write a public review (optional)..."
                rows={4}
                className="w-full px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-600 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none text-sm"
              />
            </div>
            <div className="px-4 pb-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={savePublicReview}
                disabled={savingPublic}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg disabled:opacity-60 transition"
              >
                {savingPublic ? "Saving…" : publicReviewText ? "Save changes" : "Save public review"}
              </button>
              {publicReviewText && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingPublicReview(false);
                    setEditPublicReview(publicReviewText);
                  }}
                  className="px-3 py-1.5 text-neutral-400 hover:text-neutral-200 text-sm"
                >
                  Cancel
                </button>
              )}
              {savedPublic && <span className="text-green-400 text-sm font-medium">Saved</span>}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
