"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { Check, FileUp, Loader2, SkipForward, Upload } from "lucide-react";
import { getPosterUrl } from "@/utils/imageUrl";

type Summary = {
  watched: number;
  watchlist: number;
  ratings: number;
  reviews: number;
  favorites: number;
};

type Suggestion = { tmdbId: string; title: string; year: number | null; posterPath: string | null };

type UnresolvedRow = {
  id: number;
  title: string;
  year: number | null;
  watched: boolean;
  watchlist: boolean;
  rating: number | null;
  suggestions: Suggestion[];
};

type Phase = "idle" | "uploading" | "processing" | "done";

/**
 * The import screen.
 *
 * Shaped around one fact: matching thousands of titles takes minutes, and a
 * spinner for minutes reads as broken. So the work is chunked and the progress
 * bar is driven by real completions, and the unresolved list is presented as a
 * short finishing task rather than an error report — because that's what it is.
 */
export default function ImportFlow() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [jobId, setJobId] = useState<number | null>(null);
  const [progress, setProgress] = useState({ processed: 0, total: 0, resolved: 0 });
  const [unresolved, setUnresolved] = useState<UnresolvedRow[]>([]);
  const [unresolvedTotal, setUnresolvedTotal] = useState(0);
  const [resolving, setResolving] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadUnresolved = useCallback(async (id: number) => {
    try {
      const res = await fetch(`/api/account/import/${id}?suggestions=1`);
      const data = await res.json();
      if (res.ok) {
        setUnresolved(data.unresolved ?? []);
        setUnresolvedTotal(data.unresolvedTotal ?? 0);
      }
    } catch {
      // The import already succeeded; a failed suggestions fetch isn't fatal.
    }
  }, []);

  /** Drive /process until it reports done, updating the bar each round. */
  const runProcessing = useCallback(
    async (id: number) => {
      setPhase("processing");
      for (;;) {
        const res = await fetch(`/api/account/import/${id}/process`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) {
          setError(data?.error ?? "The import stopped unexpectedly.");
          return;
        }
        setProgress({
          processed: data.processed ?? 0,
          total: data.total ?? 0,
          resolved: data.resolved ?? 0,
        });
        if (data.done) break;
      }
      await loadUnresolved(id);
      setPhase("done");
    },
    [loadUnresolved],
  );

  const upload = useCallback(
    async (file: File) => {
      setError(null);
      setPhase("uploading");

      const body = new FormData();
      body.append("file", file);

      try {
        const res = await fetch("/api/account/import", { method: "POST", body });
        const data = await res.json();
        if (!res.ok) {
          setError(data?.error ?? "Couldn't read that file.");
          setPhase("idle");
          return;
        }
        setJobId(data.jobId);
        setSummary(data.summary);
        setProgress({ processed: 0, total: data.total, resolved: 0 });
        await runProcessing(data.jobId);
      } catch {
        setError("Upload failed. Check your connection and try again.");
        setPhase("idle");
      }
    },
    [runProcessing],
  );

  const match = async (rowId: number, tmdbId: string) => {
    if (!jobId) return;
    setResolving(rowId);
    try {
      const res = await fetch(`/api/account/import/${jobId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowId, tmdbId }),
      });
      if (res.ok) {
        setUnresolved((rows) => rows.filter((r) => r.id !== rowId));
        setUnresolvedTotal((n) => Math.max(0, n - 1));
        setProgress((p) => ({ ...p, resolved: p.resolved + 1 }));
      }
    } finally {
      setResolving(null);
    }
  };

  const skip = async (rowId: number) => {
    if (!jobId) return;
    setResolving(rowId);
    try {
      const res = await fetch(`/api/account/import/${jobId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowId, skip: true }),
      });
      if (res.ok) {
        setUnresolved((rows) => rows.filter((r) => r.id !== rowId));
        setUnresolvedTotal((n) => Math.max(0, n - 1));
      }
    } finally {
      setResolving(null);
    }
  };

  // ── Idle: the drop zone ───────────────────────────────────────────────────
  if (phase === "idle") {
    return (
      <div className="space-y-6">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void upload(file);
          }}
          className={`rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
            dragging ? "border-brand-500 bg-brand-500/10" : "border-surface-700 bg-surface-900/40"
          }`}
        >
          <FileUp className="size-8 text-surface-500 mx-auto mb-3" />
          <p className="text-white font-medium">Drop your Letterboxd export here</p>
          <p className="text-surface-400 text-sm mt-1">
            The whole ZIP, or a single CSV — watched, ratings, watchlist or reviews.
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="btn-primary text-sm px-5 py-2.5 mt-5"
          >
            <Upload className="size-4" />
            Choose file
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".zip,.csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
            }}
          />
        </div>

        {error && <p className="text-rose-400 text-sm">{error}</p>}

        <div className="rounded-xl border border-surface-800 bg-surface-900/40 p-5 text-sm text-surface-400">
          <p className="text-surface-300 font-medium mb-2">Getting your export</p>
          <p>
            On Letterboxd, go to Settings → Data → Export your data. You&apos;ll get a ZIP —
            upload it here as-is.
          </p>
          <p className="mt-3">
            Nothing is overwritten. Ratings and reviews you already have here are kept, and your
            Letterboxd reviews come in as private diary notes rather than being published.
          </p>
        </div>
      </div>
    );
  }

  // ── Working ───────────────────────────────────────────────────────────────
  if (phase === "uploading" || phase === "processing") {
    const pct = progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;
    return (
      <div className="rounded-2xl border border-surface-800 bg-surface-900/40 p-8">
        <div className="flex items-center gap-3">
          <Loader2 className="size-5 animate-spin text-brand-400" />
          <p className="text-white font-medium">
            {phase === "uploading" ? "Reading your export…" : "Matching your films…"}
          </p>
        </div>

        {progress.total > 0 && (
          <>
            <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-surface-800">
              <div
                className="h-full rounded-full bg-brand-500 transition-[width] duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-3 text-sm text-surface-400">
              {progress.processed} of {progress.total} · {progress.resolved} matched
            </p>
          </>
        )}

        {summary && (
          <p className="mt-4 text-xs text-surface-500">
            {summary.watched} watched · {summary.ratings} ratings · {summary.watchlist} watchlist ·{" "}
            {summary.reviews} reviews · {summary.favorites} liked
          </p>
        )}

        <p className="mt-4 text-xs text-surface-600">
          You can leave this page — reopening the import picks up where it stopped.
        </p>
      </div>
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  const rate = progress.total > 0 ? Math.round((progress.resolved / progress.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-brand-500/20 bg-brand-500/5 p-6">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-brand-500/15">
            <Check className="size-5 text-brand-400" />
          </span>
          <div>
            <p className="text-white font-semibold">
              Imported {progress.resolved} of {progress.total} films
            </p>
            <p className="text-sm text-surface-400">{rate}% matched automatically.</p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/app/tonight" className="btn-primary text-sm px-5 py-2.5">
            Find something to watch
          </Link>
          <Link
            href="/app/profile"
            className="rounded-xl border border-surface-700 px-5 py-2.5 text-sm text-surface-300 hover:border-surface-600 hover:text-white transition"
          >
            See your profile
          </Link>
        </div>
      </div>

      {unresolvedTotal > 0 && (
        <div>
          <h2 className="text-white font-semibold">
            {unresolvedTotal} we couldn&apos;t place
          </h2>
          <p className="text-surface-400 text-sm mt-1 mb-4">
            We only match a film when we&apos;re sure — putting something in your history you never
            watched is worse than asking. Pick the right one, or skip it.
          </p>

          <ul className="space-y-3">
            {unresolved.map((row) => (
              <li
                key={row.id}
                className="rounded-xl border border-surface-800 bg-surface-900/40 p-4"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-white font-medium">
                    {row.title}
                    {row.year && <span className="text-surface-500 font-normal"> ({row.year})</span>}
                  </p>
                  <button
                    type="button"
                    onClick={() => skip(row.id)}
                    disabled={resolving === row.id}
                    className="inline-flex shrink-0 items-center gap-1 text-xs text-surface-500 hover:text-surface-300 transition disabled:opacity-50"
                  >
                    <SkipForward className="size-3.5" /> Skip
                  </button>
                </div>

                {row.suggestions.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {row.suggestions.map((s) => (
                      <button
                        key={s.tmdbId}
                        type="button"
                        onClick={() => match(row.id, s.tmdbId)}
                        disabled={resolving === row.id}
                        className="inline-flex items-center gap-2 rounded-lg border border-surface-700 bg-surface-950/60 py-1.5 pl-1.5 pr-3 text-sm text-surface-300 hover:border-brand-500/50 hover:text-white transition disabled:opacity-50"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={getPosterUrl(s.posterPath, "w92")}
                          alt=""
                          className="h-9 w-6 rounded object-cover"
                        />
                        <span>
                          {s.title}
                          {s.year && <span className="text-surface-500"> ({s.year})</span>}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-surface-500">
                    No close matches found — this one may not be on TMDB.
                  </p>
                )}
              </li>
            ))}
          </ul>

          {unresolvedTotal > unresolved.length && (
            <p className="mt-4 text-sm text-surface-500">
              Showing {unresolved.length} of {unresolvedTotal}. Reload to see the rest once
              you&apos;ve worked through these.
            </p>
          )}
        </div>
      )}

      {error && <p className="text-rose-400 text-sm">{error}</p>}
    </div>
  );
}
