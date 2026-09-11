import Link from "@components/ui/AppLink";
import type { Metadata } from "next";
import { Download, FileJson, FileSpreadsheet, Upload, ShieldCheck } from "lucide-react";
import { getAuthUserId } from "@/utils/apiAuth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your data",
  robots: { index: false, follow: false },
};

/**
 * The page that says, plainly, what happens to what you put here.
 *
 * TV Time deleted twenty-five million histories in July 2026; Trakt and Simkl
 * charge for export; Letterboxd's users are watching it be sold. Portability
 * is now a trust question, and trust is not a paragraph in a terms page —
 * it is a button that works. Two exports, the importers, and a statement in
 * ordinary words (docs/WHY_PEOPLE_COME_BACK.md §9 Bet 11).
 */
export default async function DataPage() {
  const userId = await getAuthUserId();

  return (
    <div className="w-full bg-surface-950 min-h-screen">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-white">Your data</h1>
          <p className="mt-2 text-surface-400">
            Everything you log here is yours. Here is how to take it with you, and what we do with it.
          </p>
        </header>

        {!userId ? (
          <div className="rounded-2xl border border-surface-800 bg-surface-900/60 p-8 text-center">
            <h2 className="text-white font-semibold">Sign in to see your data</h2>
            <Link href="/login" className="btn-primary text-sm px-5 py-2.5 mt-5 inline-flex">
              Sign in
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <a
              href="/api/account/export/letterboxd"
              className="flex items-start gap-4 rounded-2xl border border-surface-800 bg-surface-900/40 p-5 transition hover:border-brand-500/30"
            >
              <FileSpreadsheet className="mt-0.5 size-5 shrink-0 text-brand-400" />
              <span>
                <span className="block font-semibold text-white">Diary as CSV, for Letterboxd</span>
                <span className="mt-1 block text-sm text-surface-400">
                  One row per viewing — rewatches included — with the date, your rating and your private
                  notes. Letterboxd&apos;s importer reads it as-is. Films only; Letterboxd has no series.
                </span>
              </span>
              <Download className="ml-auto mt-1 size-4 shrink-0 text-surface-500" />
            </a>

            <a
              href="/api/account/export"
              className="flex items-start gap-4 rounded-2xl border border-surface-800 bg-surface-900/40 p-5 transition hover:border-brand-500/30"
            >
              <FileJson className="mt-0.5 size-5 shrink-0 text-brand-400" />
              <span>
                <span className="block font-semibold text-white">Everything, as JSON</span>
                <span className="mt-1 block text-sm text-surface-400">
                  Your profile, library, viewings, ratings, notes, lists, and who you follow. The whole
                  account, in a file any program can read.
                </span>
              </span>
              <Download className="ml-auto mt-1 size-4 shrink-0 text-surface-500" />
            </a>

            <Link
              href="/app/import"
              className="flex items-start gap-4 rounded-2xl border border-surface-800 bg-surface-900/40 p-5 transition hover:border-brand-500/30"
            >
              <Upload className="mt-0.5 size-5 shrink-0 text-emerald-400" />
              <span>
                <span className="block font-semibold text-white">Bring history in</span>
                <span className="mt-1 block text-sm text-surface-400">
                  From Letterboxd, Trakt, TV Time, Simkl, IMDb or Netflix. Nothing already here is
                  overwritten.
                </span>
              </span>
            </Link>

            <div className="rounded-2xl border border-surface-800 bg-surface-900/40 p-5">
              <p className="flex items-center gap-2 font-semibold text-white">
                <ShieldCheck className="size-5 text-brand-400" /> What we do with it
              </p>
              <ul className="mt-3 space-y-2 text-sm text-surface-400">
                <li>Your diary, your ratings and your notes are never sold, never used to train anything, and never shown to anyone your visibility setting does not allow.</li>
                <li>A private note stays private. Publishing is a separate act you take, on purpose, one piece of writing at a time.</li>
                <li>Nothing is deleted for you. A title leaves your library when you remove it, and your account is deleted only when you ask, after a thirty-day grace period.</li>
                <li>Export is free and always will be. It is not a feature of a paid tier; it is the reason you can trust the rest.</li>
                <li>Title data comes from TMDB; where-to-watch data from JustWatch via TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.</li>
              </ul>
              <p className="mt-4 text-xs text-surface-600">
                Account settings, including deletion, are under{" "}
                <Link href="/app/profile/setup" className="text-surface-400 underline-offset-2 hover:text-white hover:underline">
                  Edit profile
                </Link>
                .
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
