"use client";

import { useState } from "react";
import useSWR from "swr";
import toast from "react-hot-toast";
import { LoaderCircle } from "lucide-react";
import Link from "@components/ui/AppLink";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import { PERKS, priceFor, type Perk } from "@/lib/people/supporter";
import { fetchMyPledge, pledge, setMostWanted, withdrawPledge, type Pledge } from "@/lib/db/supporter";

/**
 * A season ticket for letsee: the supporter tier, pre-sold before any of it
 * is built (docs/IDEAS_2026-10.md §6.2, WHY_PEOPLE_COME_BACK.md Bet 12).
 *
 * What stays free (everything there is today), the four things supporters
 * would get, and a pledge at the price shown — 20 dollars a year, or its
 * rupee price in India. A pledge charges nothing: when supporting opens, the
 * people who pledged are asked first, here, and can say no then. Which perk
 * you'd use most decides what's built first. No counts of who else pledged.
 */
export default function SupportClient() {
  const { user, status } = useAuth();
  const me = status === "ok" ? user?.id ?? null : null;
  const price = priceFor(user?.watch_region);
  const { data: mine, mutate } = useSWR(me ? ["my-pledge", me] : null, () => fetchMyPledge(me!), { revalidateOnFocus: false });
  const [busy, setBusy] = useState(false);

  const doPledge = async () => {
    if (!me || busy) return;
    setBusy(true);
    const ok = await pledge(me, price);
    setBusy(false);
    if (!ok) {
      toast.error("That didn't save. Check your connection and try again.");
      return;
    }
    await mutate();
    toast.success("Pledged. Nothing's charged — you'll be asked first when supporting opens.");
  };

  const choose = async (perk: Perk) => {
    if (!me || !mine) return;
    const next = mine.mostWanted === perk ? null : perk;
    await mutate({ ...mine, mostWanted: next }, { revalidate: false });
    if (!(await setMostWanted(me, next))) {
      toast.error("That didn't save.");
      void mutate();
    }
  };

  const withdraw = async () => {
    if (!me || busy) return;
    setBusy(true);
    const ok = await withdrawPledge(me);
    setBusy(false);
    if (!ok) {
      toast.error("That didn't save. Try again.");
      return;
    }
    await mutate(null, { revalidate: false });
    toast("Pledge withdrawn.");
  };

  return (
    <div className="w-full bg-page pb-20">
      <section data-theme="dark" aria-labelledby="support-title" className="bg-page">
        <div className="mx-auto max-w-read px-4 pb-12 pt-10 sm:px-6 sm:pb-16 sm:pt-14">
          <p className="font-mono text-xs uppercase tracking-wider text-accent">Support letsee</p>
          <h1 id="support-title" className="mt-2 text-balance font-display text-4xl leading-tight text-ink-0 sm:text-5xl">
            A season ticket for letsee.
          </h1>
          <p className="mt-4 max-w-prose text-base leading-relaxed text-ink-300 sm:text-lg">
            letsee is made by one person, with no ads and nothing about you for sale. Servers aren&apos;t free: a supporter tier would keep it running — and give the
            people who support it a few things worth having.
          </p>
        </div>
      </section>

      <div className="mx-auto grid max-w-read gap-12 px-4 pt-10 sm:px-6">
        <section aria-labelledby="free" className="border-l-2 border-action pl-4">
          <h2 id="free" className="font-display text-2xl text-ink-0">
            Free, always
          </h2>
          <p className="mt-1 text-base leading-relaxed text-ink-300">
            Everything here today stays free — your diary, your people, rooms and passes, Tonight, export and privacy. Supporting adds things. It never takes any away, from
            anyone.
          </p>
        </section>

        <section aria-labelledby="perks">
          <h2 id="perks" className="font-display text-2xl text-ink-0">
            What supporters would get
          </h2>
          <p className="mt-1 text-sm text-ink-500">None of these exist yet. Pledges decide whether they get built, and in what order.</p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {PERKS.map((p) => (
              <li key={p.key} className="rounded-card border border-line-strong bg-raised p-4 sm:p-5">
                <h3 className="font-display text-xl text-ink-0">{p.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-400">{p.line}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="pledge" className="grid gap-5">
          <h2 id="pledge" className="sr-only">
            Your pledge
          </h2>
          <Ticket price={price.label} mine={mine ?? null} />

          {status === "anon" ? (
            <div>
              <Link href="/login?next=/app/support" className="inline-flex h-12 items-center rounded-full bg-action px-6 text-base font-semibold text-on-action transition-colors hover:bg-action-hover">
                Sign in to pledge
              </Link>
            </div>
          ) : !me || mine === undefined ? (
            <div className="h-12 w-48 rounded-full bg-raised" aria-hidden />
          ) : mine ? (
            <div className="grid gap-4">
              <div>
                <p className="text-base text-ink-0">Thank you. Which would you use most?</p>
                <p className="mt-0.5 text-sm text-ink-500">It decides what gets built first.</p>
              </div>
              <div className="flex flex-wrap gap-2" role="group" aria-label="The one you'd use most">
                {PERKS.map((p) => {
                  const on = mine.mostWanted === p.key;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      aria-pressed={on}
                      onClick={() => void choose(p.key)}
                      className={`inline-flex h-10 items-center rounded-full px-4 text-sm font-medium transition-colors ${on ? "bg-action text-on-action" : "text-ink-200 ring-1 ring-inset ring-line-input hover:bg-hover hover:text-ink-0"}`}
                    >
                      {p.title}
                    </button>
                  );
                })}
              </div>
              <button type="button" onClick={() => void withdraw()} disabled={busy} className="w-fit text-sm text-ink-500 underline decoration-line-input underline-offset-4 hover:text-ink-0 disabled:opacity-60">
                Withdraw my pledge
              </button>
            </div>
          ) : (
            <div>
              <button
                type="button"
                onClick={() => void doPledge()}
                disabled={busy}
                className="inline-flex h-12 items-center gap-2 rounded-full bg-action px-6 text-base font-semibold text-on-action transition-colors hover:bg-action-hover disabled:opacity-60"
              >
                {busy && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
                Pledge {price.label} a year
              </button>
              <p className="mt-2 text-sm text-ink-500">Nothing is charged now.</p>
            </div>
          )}
        </section>

        <section aria-labelledby="how-pledges" className="grid gap-2 border-t border-line-strong pt-6">
          <h2 id="how-pledges" className="font-mono text-xs uppercase tracking-wider text-ink-500">
            How pledges work
          </h2>
          <ul className="grid gap-1.5 text-sm leading-relaxed text-ink-400">
            <li>Nothing is charged when you pledge, and there&apos;s nothing to fill in.</li>
            <li>When supporting opens, the people who pledged are asked first — here, in letsee — and can say no then.</li>
            <li>Withdraw your pledge any time, from this page. Nobody else sees that you pledged.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}

/**
 * The ticket: the supporter tier as a thing you hold — a stub with a
 * perforation, the price on the tear-off, and a stamp once you've pledged.
 */
function Ticket({ price, mine }: { price: string; mine: Pledge | null }) {
  const stamped = mine ? new Date(mine.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null;
  return (
    // The notches sit outside the dark ticket, in the page's own colour, so they read as cut out of it.
    <div className="relative">
      <div data-theme="dark" className="flex overflow-hidden rounded-card bg-raised text-ink-0 ring-1 ring-inset ring-line-strong">
        <div className="min-w-0 flex-1 p-5 sm:p-6">
          <p className="font-mono text-xs uppercase tracking-wider text-accent">Season ticket · one year</p>
          <p className="mt-2 font-display text-3xl leading-tight sm:text-4xl">letsee supporter</p>
          <p className="mt-2 text-sm text-ink-400">{stamped ? "Pledged — thank you." : "Admits one. Everything free stays free."}</p>
        </div>
        <div aria-hidden className="w-0 border-l-2 border-dashed border-line-input" />
        <div className="flex w-28 shrink-0 flex-col items-center justify-center gap-1 p-4 text-center sm:w-36">
          <span className="font-display text-3xl sm:text-4xl">{price}</span>
          <span className="font-mono text-xs uppercase tracking-wide text-ink-400">a year</span>
          {stamped && <span className="mt-2 rounded-sm px-1.5 py-0.5 font-mono text-xs uppercase tracking-wide text-accent ring-1 ring-inset ring-accent">Pledged {stamped}</span>}
        </div>
      </div>
      <span aria-hidden className="absolute -top-3 right-25 size-6 rounded-full bg-page sm:right-33" />
      <span aria-hidden className="absolute -bottom-3 right-25 size-6 rounded-full bg-page sm:right-33" />
    </div>
  );
}
