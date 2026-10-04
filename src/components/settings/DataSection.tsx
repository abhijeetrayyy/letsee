"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Download, FileJson, FileSpreadsheet, ShieldCheck, Upload } from "lucide-react";
import Link from "@components/ui/AppLink";
import { supabase } from "@/utils/supabase/client";
import { Labeled, Section, inputClass } from "./Field";

const row = "flex items-start gap-4 rounded-control p-3 -mx-3 transition-colors hover:bg-hover";

/**
 * Your data (was `/app/data`): the two exports, the importers, and what
 * happens to what you put here, in ordinary words — portability is a trust
 * question, answered with buttons that work (WHY_PEOPLE_COME_BACK.md Bet 11).
 */
export function DataSection() {
  return (
    <Section id="your-data" title="Your data" hint="Everything you log here is yours. Take it with you whenever you like.">
      <a href="/api/account/export/letterboxd" className={row}>
        <FileSpreadsheet className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-ink-0">Diary as CSV, for Letterboxd</span>
          <span className="mt-0.5 block text-sm text-ink-500">
            One row per viewing, rewatches included, with the date, your rating and your private notes. Films only; Letterboxd has no series.
          </span>
        </span>
        <Download className="mt-1 size-4 shrink-0 text-ink-500" aria-hidden />
      </a>
      <a href="/api/account/export" className={row}>
        <FileJson className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-ink-0">Everything, as JSON</span>
          <span className="mt-0.5 block text-sm text-ink-500">Your profile, library, viewings, ratings, notes, lists and who you follow, in a file any program can read.</span>
        </span>
        <Download className="mt-1 size-4 shrink-0 text-ink-500" aria-hidden />
      </a>
      <Link href="/app/import" className={row}>
        <Upload className="mt-0.5 size-5 shrink-0 text-ink-300" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-ink-0">Bring your history in</span>
          <span className="mt-0.5 block text-sm text-ink-500">From Letterboxd, Trakt, TV Time, Simkl, IMDb or Netflix. Nothing already here is overwritten.</span>
        </span>
      </Link>

      <div className="border-t border-line pt-4">
        <p className="flex items-center gap-2 font-semibold text-ink-0">
          <ShieldCheck className="size-5 text-accent" aria-hidden /> What we do with it
        </p>
        <ul className="mt-3 grid gap-2 text-sm leading-relaxed text-ink-400">
          <li>Your diary, ratings and notes are never sold, never used to train anything, and never shown to anyone your privacy settings don&apos;t allow.</li>
          <li>A private note stays private. Sharing your words is a separate thing you do, on purpose, one piece of writing at a time.</li>
          <li>Nothing is deleted for you. A title leaves your library when you remove it; your account goes only when you ask, after thirty days.</li>
          <li>Export is free and always will be.</li>
          <li>
            Film and series data come from{" "}
            <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer" className="underline decoration-line-input underline-offset-4 hover:text-ink-0">
              TMDB
            </a>
            , where to watch from JustWatch via TMDB. letsee uses the TMDB API but is not endorsed or certified by TMDB.
          </li>
        </ul>
      </div>
    </Section>
  );
}

/**
 * Account: the address you sign in with, and leaving. Deleting asks for your
 * password — the route re-authenticates on the server, so an unlocked laptop
 * can't schedule someone's account for deletion — and is the one typed
 * confirmation in the product (PAGES.md §7).
 */
export function AccountSection({ email }: { email: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload?.error || "Couldn't delete your account.");
        return;
      }
      // The route signed the session out on the server; clear this one too.
      await supabase.auth.signOut().catch(() => {});
      toast.success(payload?.message || "Your account will be deleted in 30 days.");
      router.replace("/login?status=account-deleted");
    } catch {
      setError("Couldn't reach letsee. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section id="account" title="Account">
      <div>
        <p className="text-sm font-medium text-ink-200">Signed in as</p>
        <p className="mt-0.5 break-all text-base text-ink-0">{email || "—"}</p>
      </div>

      <div className="border-t border-line pt-4">
        <p className="text-sm font-medium text-ink-200">Delete your account</p>
        <p className="mt-1 text-sm text-ink-500">
          It closes now and is erased after 30 days: your diary, ratings, words, lists and rooms. Signing back in before then cancels it.
        </p>
        {!open ? (
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              setPassword("");
              setError("");
            }}
            className="mt-3 h-10 rounded-full px-4 text-sm font-medium text-danger ring-1 ring-inset ring-danger/50 transition-colors hover:bg-danger/10"
          >
            Delete my account…
          </button>
        ) : (
          <form onSubmit={confirm} className="mt-3 grid gap-3 rounded-control bg-danger/5 p-4 ring-1 ring-inset ring-danger/30">
            <Labeled id="settings-delete-password" label="Your password, to confirm">
              <input
                id="settings-delete-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
                aria-invalid={!!error}
                aria-describedby={error ? "settings-delete-error" : undefined}
                className={inputClass}
              />
            </Labeled>
            {error && (
              <p id="settings-delete-error" role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={busy || !password}
                className="h-10 rounded-full bg-danger-fill px-4 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
              >
                {busy ? "Closing your account…" : "Delete my account"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                className="h-10 rounded-full px-4 text-sm font-medium text-ink-200 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover"
              >
                Keep it
              </button>
            </div>
          </form>
        )}
      </div>
    </Section>
  );
}
