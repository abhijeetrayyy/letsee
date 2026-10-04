"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import Sheet from "@components/ds/Sheet";
import Avatar from "@components/ui/Avatar";
import type { RoomPerson } from "@/lib/db/rooms";
import { myScore, sendThanks } from "@/lib/db/upNext";
import { stars } from "@/lib/people/moments";

/**
 * Say thanks (docs/design/RETHINK.md §6, "Close"): after you log something
 * someone passed you, a line to them with your rating, pre-filled and yours
 * to change. It arrives in your room as a message; nobody is reminded if you
 * never send it.
 */
export default function ThanksSheet({
  open,
  onClose,
  me,
  to,
  itemId,
  itemType,
  itemName,
}: {
  open: boolean;
  onClose: () => void;
  me: string;
  to: RoomPerson;
  itemId: string;
  itemType: "movie" | "tv";
  itemName: string;
}) {
  const [text, setText] = useState(`Watched ${itemName}. Thank you for this one.`);
  const [busy, setBusy] = useState(false);

  // Your rating, if you gave one, goes in the first line.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    void myScore(me, itemId, itemType).then((score) => {
      if (alive && score) setText(`Watched ${itemName}. ${stars(score)}. Thank you for this one.`);
    });
    return () => {
      alive = false;
    };
  }, [open, me, itemId, itemType, itemName]);

  const send = async () => {
    setBusy(true);
    const error = await sendThanks(me, to.id, text);
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(`Sent to ${to.username}`);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={`Say thanks to ${to.username}`} description="It goes to your room with them.">
      <div className="grid gap-4">
        <div className="flex items-center gap-3">
          <Avatar src={to.avatarUrl} name={to.username} size={36} />
          <span className="text-sm text-ink-400">
            {to.username} passed you <span className="font-display text-base text-ink-0">{itemName}</span>
          </span>
        </div>
        <label htmlFor="thanks-text" className="sr-only">
          Your message
        </label>
        <textarea
          id="thanks-text"
          rows={3}
          maxLength={2000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full resize-none rounded-control bg-raised px-3.5 py-3 text-base text-ink-0 ring-1 ring-inset ring-line-input focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        />
        <button
          type="button"
          onClick={send}
          disabled={busy || !text.trim()}
          className="inline-flex h-11 w-full items-center justify-center rounded-full bg-action font-semibold text-on-action hover:bg-action-hover disabled:opacity-60"
        >
          {busy ? "Sending…" : `Send to ${to.username}`}
        </button>
      </div>
    </Sheet>
  );
}
