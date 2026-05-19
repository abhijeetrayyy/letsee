"use client";

import React, { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { BookOpen, Globe, Pencil, Trash2, Save, X } from "lucide-react";

interface WatchedReviewProps {
  itemId: number | string;
  itemType: "movie" | "tv";
  isWatched?: boolean;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch { return iso; }
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch { return iso; }
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
      body?.error ? null : { diaryText: body?.diaryText ?? null, publicReviewText: body?.publicReviewText ?? null, watchedAt: body?.watchedAt ?? null }
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
  const [editingDiary, setEditingDiary] = useState(false);
  const [editingPublicReview, setEditingPublicReview] = useState(false);
  const [deletingDiary, setDeletingDiary] = useState(false);
  const [deletingPublic, setDeletingPublic] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loggedOut, setLoggedOut] = useState(false);
  const [notWatched, setNotWatched] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const retryRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setError(null); setLoggedOut(false); setNotWatched(false);
    retryRef.current = false; setLoading(true);

    const fetchOne = () =>
      doFetch(String(itemId), itemType).then((data) => {
        if (cancelled) return;
        if (data === null) {
          setNotWatched(true); setLoading(false);
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
                } setLoading(false);
              }), 500);
          } return;
        }
        setDiaryText(data.diaryText ?? null);
        setPublicReviewText(data.publicReviewText ?? null);
        setWatchedAt(data.watchedAt ?? null);
        setEditDiary(data.diaryText ?? "");
        setEditPublicReview(data.publicReviewText ?? "");
        setLoading(false);
      });

    fetchOne().catch(() => { if (!cancelled) setError("Failed to load"); if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
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

  useEffect(() => {
    if (editingPublicReview) setCharCount(editPublicReview.length);
    else if (editingDiary) setCharCount(editDiary.length);
  }, [editDiary, editPublicReview, editingDiary, editingPublicReview]);

  const saveDiary = async () => {
    setSavingDiary(true); setError(null);
    try {
      const res = await fetch("/api/watched-review", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: String(itemId), itemType, diaryText: editDiary.trim() || null }),
        credentials: "include",
      });
      const body = await res.json();
      if (!res.ok) { setError(body?.error || "Failed to save diary"); return; }
      setDiaryText(body?.diaryText ?? null);
      setEditDiary(body?.diaryText ?? "");
      setEditingDiary(false);
      toast.success("Diary saved");
    } catch { setError("Failed to save diary"); toast.error("Failed to save diary"); }
    finally { setSavingDiary(false); }
  };

  const deleteDiary = async () => {
    if (!window.confirm("Delete this diary note?")) return;
    setDeletingDiary(true); setError(null);
    try {
      const res = await fetch("/api/watched-review", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: String(itemId), itemType, diaryText: null }),
        credentials: "include",
      });
      const body = await res.json();
      if (!res.ok) { setError(body?.error || "Failed to delete"); return; }
      setDiaryText(null); setEditDiary(""); setEditingDiary(false);
      toast.success("Diary note deleted");
    } catch { setError("Failed to delete diary"); toast.error("Failed to delete diary"); }
    finally { setDeletingDiary(false); }
  };

  const savePublicReview = async () => {
    setSavingPublic(true); setError(null);
    try {
      const res = await fetch("/api/watched-review", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: String(itemId), itemType, publicReviewText: editPublicReview.trim() || null }),
        credentials: "include",
      });
      const body = await res.json();
      if (!res.ok) { setError(body?.error || "Failed to save public review"); return; }
      setPublicReviewText(body?.publicReviewText ?? null);
      setEditPublicReview(body?.publicReviewText ?? "");
      setEditingPublicReview(false);
      toast.success("Public review saved");
    } catch { setError("Failed to save public review"); toast.error("Failed to save public review"); }
    finally { setSavingPublic(false); }
  };

  const deletePublicReview = async () => {
    if (!window.confirm("Delete this public review? It will no longer appear in Reviews.")) return;
    setDeletingPublic(true); setError(null);
    try {
      const res = await fetch("/api/watched-review", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: String(itemId), itemType, publicReviewText: null }),
        credentials: "include",
      });
      const body = await res.json();
      if (!res.ok) { setError(body?.error || "Failed to delete"); return; }
      setPublicReviewText(null); setEditPublicReview(""); setEditingPublicReview(false);
      toast.success("Public review deleted");
    } catch { setError("Failed to delete public review"); toast.error("Failed to delete public review"); }
    finally { setDeletingPublic(false); }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="glass-card rounded-2xl p-5 animate-pulse">
            <div className="h-4 bg-surface-800 rounded w-28 mb-3" />
            <div className="h-16 bg-surface-800 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (loggedOut) return null;

  if (notWatched) {
    return (
      <div className="card-accent rounded-2xl p-5 border border-brand-500/10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-1 h-6 rounded-full bg-brand-500 shrink-0" />
          <h3 className="text-sm font-semibold text-surface-200">Your Diary & Review</h3>
        </div>
        <p className="text-xs text-surface-500 leading-relaxed">
          Mark this as <span className="text-brand-400 font-medium">Watched</span> to add private diary notes and optionally publish a public review.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-up">
      {error && <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}

      {/* Diary */}
      <div className="card-accent rounded-2xl overflow-hidden">
        <div className="px-5 pt-4 pb-2 flex items-center gap-3">
          <div className="w-1 h-6 rounded-full bg-brand-500 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-surface-100">Your Diary</h3>
            <p className="text-[10px] text-surface-500">Private notes. Only you can see this.</p>
          </div>
        </div>
        {diaryText && !editingDiary ? (
          <div className="px-5 pb-4">
            <div className="flex items-start gap-3 bg-surface-800/30 rounded-xl p-4">
              <span className="shrink-0 text-[10px] text-surface-500 font-medium mt-0.5 min-w-[80px]">
                {watchedAt ? formatDateTime(watchedAt) : ""}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-surface-200 whitespace-pre-wrap leading-relaxed">{diaryText}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button onClick={() => { setEditDiary(diaryText); setEditingDiary(true); }} className="btn-ghost p-2">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={deleteDiary} disabled={deletingDiary} className="btn-danger p-2">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-5 pb-4">
            <textarea
              value={editDiary}
              onChange={(e) => setEditDiary(e.target.value)}
              placeholder="Your private notes... what did you think?"
              rows={3}
              className="textarea-field"
            />
            <div className="flex items-center gap-2 mt-3">
              <button onClick={saveDiary} disabled={savingDiary} className="btn-primary text-xs !py-2 !px-4">
                <Save className="w-3.5 h-3.5" />
                {savingDiary ? "Saving..." : diaryText ? "Update" : "Save diary"}
              </button>
              {diaryText && (
                <button onClick={() => { setEditingDiary(false); setEditDiary(diaryText); }} className="btn-ghost text-xs">
                  <X className="w-3.5 h-3.5" /> Cancel
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Public Review */}
      <div className="card-accent rounded-2xl overflow-hidden border border-brand-500/10">
        <div className="px-5 pt-4 pb-2 flex items-center gap-3">
          <div className="w-1 h-6 rounded-full bg-brand-500 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-surface-100">Your Public Review</h3>
            <p className="text-[10px] text-surface-500">Shared with everyone</p>
          </div>
        </div>
        {publicReviewText && !editingPublicReview ? (
          <div className="px-5 pb-4">
            <div className="bg-surface-800/30 rounded-xl p-4">
              <p className="text-sm text-surface-200 whitespace-pre-wrap leading-relaxed">{publicReviewText}</p>
            </div>
            <div className="flex gap-1 mt-3">
              <button onClick={() => { setEditPublicReview(publicReviewText); setEditingPublicReview(true); }} className="btn-ghost text-xs">
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
              <button onClick={deletePublicReview} disabled={deletingPublic} className="btn-danger text-xs">
                <Trash2 className="w-3.5 h-3.5" /> {deletingPublic ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        ) : (
          <div className="px-5 pb-4">
            <textarea
              value={editPublicReview}
              onChange={(e) => setEditPublicReview(e.target.value)}
              placeholder="Write a public review... share your thoughts with the community!"
              rows={4}
              className="textarea-field"
              maxLength={2000}
            />
            <div className="flex items-center justify-between mt-3">
              <span className={`text-[10px] ${charCount > 0 && charCount >= 1900 ? "text-amber-400" : "text-surface-600"}`}>
                {charCount}/2000
              </span>
              <div className="flex items-center gap-2">
                {publicReviewText && (
                  <button onClick={() => { setEditingPublicReview(false); setEditPublicReview(publicReviewText); }} className="btn-ghost text-xs">
                    <X className="w-3.5 h-3.5" /> Cancel
                  </button>
                )}
                <button onClick={savePublicReview} disabled={savingPublic} className="btn-primary text-xs !py-2 !px-4">
                  <Save className="w-3.5 h-3.5" />
                  {savingPublic ? "Saving..." : publicReviewText ? "Update" : "Publish review"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
