"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "@components/ui/AppLink";
import Avatar from "@components/ui/Avatar";
import AnswerSheet from "@components/ds/AnswerSheet";
import { fetchAsksForMe, type AskForMe } from "@/lib/db/asks";

/**
 * Your people asking for a film (migration 110), on Home: who asks, the
 * question, and Answer — a pass from you, tagged with their question.
 * Renders nothing when nobody is asking.
 */
export default function AsksForYou({ me }: { me: string }) {
  const { data, mutate } = useSWR(["asks-for-me", me], () => fetchAsksForMe(me), { revalidateOnFocus: false });
  const [answering, setAnswering] = useState<AskForMe | null>(null);
  const asks = (data ?? []).filter((a) => a.answered < 3).slice(0, 4);
  if (!asks.length) return null;

  return (
    <section aria-labelledby="asks-for-you">
      <h2 id="asks-for-you" className="mb-4 text-2xl text-ink-0 sm:text-3xl">
        Your people are asking
      </h2>
      <ul className="flex flex-col gap-3">
        {asks.map((a) => (
          <li key={a.id} className="flex items-start gap-3 rounded-card border border-line-strong bg-raised p-4">
            <Link href={`/app/people/${encodeURIComponent(a.by.username)}`} className="shrink-0">
              <Avatar src={a.by.avatarUrl} name={a.by.username} size={40} />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink-400">
                <span className="font-medium text-ink-0">{a.by.username}</span> asks
              </p>
              <p className="mt-0.5 font-display text-lg italic leading-snug text-ink-0">“{a.question}”</p>
              {a.answered > 0 && <p className="mt-1 text-xs text-ink-500">You answered{a.answered > 1 ? ` with ${a.answered}` : ""}.</p>}
            </div>
            <button type="button" onClick={() => setAnswering(a)} className="inline-flex h-10 shrink-0 items-center rounded-full bg-action px-4 text-sm font-semibold text-on-action hover:bg-action-hover">
              {a.answered > 0 ? "Another" : "Answer"}
            </button>
          </li>
        ))}
      </ul>
      <AnswerSheet ask={answering} onClose={() => setAnswering(null)} onAnswered={() => void mutate()} />
    </section>
  );
}
