"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import Sheet from "@components/ds/Sheet";
import TitlePicker, { type PickedTitle } from "@components/ds/TitlePicker";
import { answerAsk, type AskForMe } from "@/lib/db/asks";
import { PASS_WORDS_MAX } from "@/lib/db/passes";
import { getPosterUrl } from "@/utils/imageUrl";

/** Answer someone's ask with a film (and, if you like, a line why). It's a pass, from you. */
export default function AnswerSheet({ ask, onClose, onAnswered }: { ask: AskForMe | null; onClose: () => void; onAnswered?: () => void }) {
  const [picked, setPicked] = useState<PickedTitle | null>(null);
  const [words, setWords] = useState("");
  const [busy, setBusy] = useState(false);

  const close = () => {
    setPicked(null);
    setWords("");
    onClose();
  };
  const answer = async () => {
    if (!ask || !picked || busy) return;
    setBusy(true);
    const result = await answerAsk(ask.id, picked, words);
    setBusy(false);
    if (result === "answered") {
      toast.success(`Sent to ${ask.by.username}`);
      onAnswered?.();
      close();
      return;
    }
    toast.error(result === "enough" ? "Three films is plenty for one ask." : result === "gone" ? "That ask has closed." : "That didn't send. Check your connection.");
  };

  return (
    <Sheet open={!!ask} onClose={close} title={ask ? `${ask.by.username} asks` : "Answer"} description={ask ? `“${ask.question}”` : undefined}>
      <div className="flex flex-col gap-4">
        {!picked ? (
          <TitlePicker onPick={setPicked} placeholder="Which film or series?" />
        ) : (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={getPosterUrl(picked.imageUrl, "w92")} alt="" className="aspect-2/3 w-11 shrink-0 rounded-media bg-hover object-cover" />
            <span className="min-w-0 flex-1 truncate font-display text-lg text-ink-0">{picked.itemName}</span>
            <button type="button" onClick={() => setPicked(null)} className="rounded-full px-3 py-1.5 text-sm text-ink-400 hover:bg-hover hover:text-ink-0">
              Change
            </button>
          </div>
        )}
        {picked && (
          <>
            <textarea
              rows={2}
              maxLength={PASS_WORDS_MAX}
              value={words}
              onChange={(e) => setWords(e.target.value)}
              placeholder="Why this one (optional)"
              className="w-full resize-none rounded-control bg-raised px-3.5 py-3 font-display text-base italic text-ink-0 ring-1 ring-inset ring-line-input placeholder:not-italic placeholder:text-ink-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            />
            <button type="button" onClick={() => void answer()} disabled={busy} className="inline-flex h-11 items-center justify-center rounded-full bg-action font-semibold text-on-action hover:bg-action-hover disabled:opacity-60">
              {busy ? "Sending…" : `Send it to ${ask?.by.username}`}
            </button>
          </>
        )}
      </div>
    </Sheet>
  );
}
