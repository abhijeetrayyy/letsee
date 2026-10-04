"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import Sheet from "@components/ds/Sheet";
import { createAsk } from "@/lib/db/asks";
import { cleanQuestion, MAX_QUESTION, QUESTIONS } from "@/lib/people/asks";

/**
 * Ask your people (migration 110): one question, seen by your people for
 * three days; each answers with a film, which lands in your Up next from them.
 */
export default function AskSheet({ open, onClose, onAsked }: { open: boolean; onClose: () => void; onAsked?: () => void }) {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);

  const ask = async () => {
    if (question.trim().length < 3 || busy) return;
    setBusy(true);
    const { id, error } = await createAsk(question.trim());
    setBusy(false);
    if (!id) {
      toast.error(error ?? "Couldn't ask.");
      return;
    }
    toast.success("Asked. Your people will see it for three days.");
    setQuestion("");
    onAsked?.();
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Ask your people" description="The people you watch with see it for three days, and answer with a film each.">
      <div className="flex flex-col gap-4">
        <textarea
          rows={2}
          maxLength={MAX_QUESTION}
          value={question}
          onChange={(e) => setQuestion(cleanQuestion(e.target.value))}
          placeholder="What are you in the mood for?"
          className="w-full resize-none rounded-control bg-raised px-3.5 py-3 font-display text-lg text-ink-0 ring-1 ring-inset ring-line-input placeholder:text-ink-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        />
        <ul className="flex flex-wrap gap-2">
          {QUESTIONS.map((q) => (
            <li key={q}>
              <button type="button" onClick={() => setQuestion(q)} className="inline-flex h-9 items-center rounded-full px-3.5 text-sm text-ink-300 ring-1 ring-inset ring-line-input hover:bg-hover hover:text-ink-0">
                {q}
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => void ask()}
          disabled={busy || question.trim().length < 3}
          className="inline-flex h-11 items-center justify-center rounded-full bg-action font-semibold text-on-action hover:bg-action-hover disabled:opacity-60"
        >
          {busy ? "Asking…" : "Ask"}
        </button>
      </div>
    </Sheet>
  );
}
