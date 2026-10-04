"use client";

import { useState } from "react";
import useSWR from "swr";
import toast from "react-hot-toast";
import { MessageCircleQuestion } from "lucide-react";
import Link from "@components/ui/AppLink";
import Avatar from "@components/ui/Avatar";
import AskSheet from "@components/ds/AskSheet";
import { closeAsk, fetchMyAsks } from "@/lib/db/asks";
import { askState } from "@/lib/people/asks";
import { getPosterUrl } from "@/utils/imageUrl";
import { titlePath } from "@/utils/urls";

/**
 * Your asks, in Up next (migration 110): the question, how it's going, and
 * the films your people answered with — each also in *From people*, because
 * an answer is a pass. Ask another from here.
 */
export default function YourAsks({ me }: { me: string }) {
  const { data, mutate } = useSWR(["my-asks", me], () => fetchMyAsks(me), { revalidateOnFocus: false });
  const [asking, setAsking] = useState(false);
  const recent = (data ?? []).filter((a) => askState({ ...a, answers: a.answers.length }).open || a.answers.length > 0).slice(0, 3);

  const close = async (id: number) => {
    if (await closeAsk(me, id)) void mutate();
    else toast.error("That didn't save. Check your connection.");
  };

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={() => setAsking(true)} className="inline-flex h-10 items-center gap-2 self-start rounded-full px-4 text-sm font-medium text-ink-200 ring-1 ring-inset ring-line-input hover:bg-hover hover:text-ink-0">
        <MessageCircleQuestion className="size-4" aria-hidden />
        Ask your people
      </button>
      {recent.map((a) => {
        const state = askState({ ...a, answers: a.answers.length });
        return (
          <div key={a.id} className="rounded-card border border-line-strong bg-raised p-4">
            <p className="font-display text-lg italic leading-snug text-ink-0">“{a.question}”</p>
            <p className="mt-1 font-mono text-xs uppercase tracking-wide text-ink-500">{state.line}</p>
            {a.answers.length > 0 && (
              <ul className="no-scrollbar -mx-1 mt-3 flex gap-3 overflow-x-auto px-1 pb-1">
                {a.answers.map((ans) => (
                  <li key={`${ans.from.id}:${ans.itemType}:${ans.itemId}`} className="w-24 shrink-0">
                    <Link href={titlePath(ans.itemType, ans.itemId, ans.itemName)} className="group block">
                      <span className="relative block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={getPosterUrl(ans.imageUrl, "w185")} alt="" loading="lazy" className="aspect-2/3 w-full rounded-media object-cover ring-1 ring-inset ring-line" />
                        <span className="absolute bottom-1 left-1 rounded-full ring-2 ring-raised">
                          <Avatar src={ans.from.avatarUrl} name={ans.from.username} size={22} />
                        </span>
                      </span>
                      <span className="mt-1.5 block truncate text-xs text-ink-300">{ans.itemName}</span>
                      <span className="block truncate text-xs text-ink-500">from {ans.from.username}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {state.open && (
              <button type="button" onClick={() => void close(a.id)} className="mt-3 text-sm text-ink-500 underline decoration-line-input underline-offset-4 hover:text-ink-0">
                Close it
              </button>
            )}
          </div>
        );
      })}
      <AskSheet open={asking} onClose={() => setAsking(false)} onAsked={() => void mutate()} />
    </div>
  );
}
