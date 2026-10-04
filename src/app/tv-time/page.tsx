import Link from "@components/ui/AppLink";
import type { Metadata } from "next";
import { CalendarDays, Download, Lock, Tv, Users } from "lucide-react";

/**
 * For the people who lost TV Time.
 *
 * TV Time shut down on 2026-07-15 and deleted its data. Its users did not
 * love the tracker; they loved the ritual — tick the episode, then read what
 * everyone said, hidden until you had. This page says what happens to their
 * export here, in their words, and nothing else. It is the one public page
 * on the site that is a landing rather than a title, and it is deliberately
 * plain.
 *
 * Not indexed, like the rest of the app: robots.txt disallows everything
 * since the August incident (tests/invariants/nothing-is-crawlable.test.ts).
 * It is reached by a link, which is how a wave of orphaned users travels
 * anyway — one person posting it in the thread where the rest are asking.
 */
export const metadata: Metadata = {
  title: "After TV Time",
  description:
    "Bring your TV Time export here. Every episode you ticked, dated. Threads that open once you've watched. Your data is yours to take back out, always.",
  robots: { index: false, follow: false },
};

export default function TvTimePage() {
  return (
    <div className="w-full bg-page min-h-screen">
      <div className="max-w-read mx-auto px-4 sm:px-6 py-14 sm:py-20">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent">After TV Time</p>
        <h1 className="mt-3 text-3xl sm:text-4xl font-medium tracking-tight text-ink-0">
          The tick is still here. So is the thread that opens after it.
        </h1>
        <p className="mt-4 text-lg text-ink-300">
          TV Time closed in July and deleted its data. If you asked for your export before it did,
          it works here as-is — every episode you ticked, on the day you ticked it.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/app/import" className="btn-primary px-5 py-2.5 text-sm">
            Import your TV Time export
          </Link>
          <Link
            href="/signup"
            className="rounded-xl border border-line-strong px-5 py-2.5 text-sm text-ink-300 transition hover:border-line-input hover:text-ink-0"
          >
            Make an account first
          </Link>
        </div>

        <ul className="mt-12 space-y-6">
          <li className="flex gap-4">
            <Tv className="mt-1 size-5 shrink-0 text-accent" />
            <div>
              <p className="font-semibold text-ink-0">Episodes, not just shows</p>
              <p className="mt-1 text-sm text-ink-400">
                One tap marks the next episode from the home page. A show you are caught up on says
                when it is back, and never disappears on you.
              </p>
            </div>
          </li>
          <li className="flex gap-4">
            <Lock className="mt-1 size-5 shrink-0 text-accent" />
            <div>
              <p className="font-semibold text-ink-0">Spoilers wait for you</p>
              <p className="mt-1 text-sm text-ink-400">
                An episode&apos;s overview, its stills and its thread stay hidden until you have marked
                it watched. Then you read what everyone said.
              </p>
            </div>
          </li>
          <li className="flex gap-4">
            <Users className="mt-1 size-5 shrink-0 text-accent" />
            <div>
              <p className="font-semibold text-ink-0">Who you watched it with</p>
              <p className="mt-1 text-sm text-ink-400">
                A viewing carries the people who were there. Name them, and they can add it to their
                own diary with one tap.
              </p>
            </div>
          </li>
          <li className="flex gap-4">
            <CalendarDays className="mt-1 size-5 shrink-0 text-accent" />
            <div>
              <p className="font-semibold text-ink-0">Films and series in one diary</p>
              <p className="mt-1 text-sm text-ink-400">
                Letterboxd, Trakt, Simkl, IMDb and Netflix history import the same way.
              </p>
            </div>
          </li>
          <li className="flex gap-4">
            <Download className="mt-1 size-5 shrink-0 text-accent" />
            <div>
              <p className="font-semibold text-ink-0">Yours to take back out</p>
              <p className="mt-1 text-sm text-ink-400">
                Export everything as JSON, or as a CSV Letterboxd can read, whenever you like. Nothing
                here is behind a paid tier, and nothing is deleted for you.
              </p>
            </div>
          </li>
        </ul>

        <p className="mt-12 text-xs text-ink-600">
          No export? TV Time&apos;s data is gone, and nobody can get it back. Start with what you
          remember: the shows you are watching now, and the one you would rewatch.
        </p>
      </div>
    </div>
  );
}
