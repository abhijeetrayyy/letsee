"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Calendar } from "lucide-react";
import Sheet from "@components/ds/Sheet";
import TitlePicker, { type PickedTitle } from "@components/ds/TitlePicker";
import { logViewing } from "@/lib/db/viewings";
import { fetchMyTake, saveMyTake } from "@/lib/db/takes";
import type { RoomPerson } from "@/lib/db/rooms";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import { NA } from "@/utils/takes";
import { todayIso } from "@/utils/viewings";
import { getPosterUrl } from "@/utils/imageUrl";

/**
 * Log one together, from their room (docs/design/RETHINK.md §4, header
 * actions). Pick the film and the day; it goes in your diary with them on it,
 * and they are asked whether they were there — nothing lands in their diary
 * until they say yes (096's co-log invite). A line about it, if you write one,
 * is for the two of you: a take with `visibility = 'us'` (112), which they read
 * in this room and on the film's page.
 */
function yesterdayIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function LogTogetherSheet({
  open,
  onClose,
  person,
  onLogged,
}: {
  open: boolean;
  onClose: () => void;
  person: RoomPerson;
  onLogged?: () => void;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState<PickedTitle | null>(null);
  const [day, setDay] = useState(todayIso());
  const [line, setLine] = useState("");
  const [busy, setBusy] = useState(false);

  const close = () => {
    onClose();
    setTitle(null);
    setDay(todayIso());
    setLine("");
  };

  /**
   * The line goes on your non-public take, marked for the people who were
   * there. Three things it must not do: overwrite words you already keep on
   * this film, private or "us" (it says so instead); move a public review off
   * your shelf (`alongside` adds the private row next to it); and clear your
   * rating — a take carries its score, so the existing one is sent along. If
   * the existing take can't be read, nothing is written.
   */
  const saveLine = async (picked: PickedTitle): Promise<"saved" | "kept-note" | "failed"> => {
    if (!user || !line.trim()) return "saved";
    const id = { itemId: picked.itemId, itemType: picked.itemType, scope: "title" as const, seasonNumber: NA, episodeNumber: NA };
    const existing = await fetchMyTake(user.id, id).catch(() => null);
    if (!existing) return "failed";
    const priv = existing.take && !existing.take.isPublic ? existing.take : existing.privateNote;
    if (priv?.body.trim()) return "kept-note";
    const error = await saveMyTake(user.id, id, {
      score: existing.take?.score ?? null,
      body: line,
      isPublic: false,
      forUs: true,
      alongside: true,
      itemName: picked.itemName,
      imageUrl: picked.imageUrl,
    });
    return error ? "failed" : "saved";
  };

  const log = async () => {
    if (!title || busy) return;
    setBusy(true);
    const { error } = await logViewing({
      itemId: title.itemId,
      itemType: title.itemType,
      itemName: title.itemName,
      imageUrl: title.imageUrl,
      watchedOn: day,
      companions: [{ userId: person.id }],
    });
    if (error) {
      setBusy(false);
      toast.error(error);
      return;
    }
    const said = await saveLine(title);
    setBusy(false);
    if (said === "kept-note") toast.success(`Logged with ${person.username}. You already have words on it — open the film to change who sees them.`);
    else if (said === "failed") toast.error(`Logged with ${person.username}, but your line didn't save. Add it from the film's page.`);
    else toast.success(`Logged with ${person.username}`);
    onLogged?.();
    close();
  };

  const chip = (on: boolean) =>
    `inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors ${
      on ? "bg-action text-on-action" : "text-ink-300 ring-1 ring-inset ring-line-input hover:bg-hover hover:text-ink-0"
    }`;

  return (
    <Sheet open={open} onClose={close} title={`Log one with ${person.username}`} description={`${person.username} will be asked whether they were there too.`}>
      <div className="grid gap-5">
        {!title ? (
          <TitlePicker onPick={setTitle} placeholder="What did you watch?" />
        ) : (
          <>
            <div className="flex items-center gap-3">
              <img src={getPosterUrl(title.imageUrl, "w92")} alt="" className="aspect-2/3 w-11 shrink-0 rounded-media bg-hover object-cover" />
              <span className="min-w-0 flex-1 truncate font-display text-lg text-ink-0">{title.itemName}</span>
              <button type="button" onClick={() => setTitle(null)} className="rounded-full px-3 py-1.5 text-sm text-ink-400 hover:bg-hover hover:text-ink-0">
                Change
              </button>
            </div>
            <fieldset>
              <legend className="mb-2 text-xs font-medium text-ink-500">When</legend>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={chip(day === todayIso())} aria-pressed={day === todayIso()} onClick={() => setDay(todayIso())}>
                  Today
                </button>
                <button type="button" className={chip(day === yesterdayIso())} aria-pressed={day === yesterdayIso()} onClick={() => setDay(yesterdayIso())}>
                  Last night
                </button>
                <label className={chip(day !== todayIso() && day !== yesterdayIso())}>
                  <Calendar className="size-4" aria-hidden />
                  <span>{day !== todayIso() && day !== yesterdayIso() ? day : "Pick a day"}</span>
                  <input type="date" className="sr-only" max={todayIso()} value={day} onChange={(e) => e.target.value && setDay(e.target.value)} />
                </label>
              </div>
            </fieldset>
            <div className="grid gap-1.5">
              <label htmlFor="together-line" className="text-xs font-medium text-ink-500">
                Something to say about it <span className="font-normal">(optional)</span>
              </label>
              <textarea
                id="together-line"
                rows={2}
                maxLength={500}
                value={line}
                onChange={(e) => setLine(e.target.value)}
                placeholder="What stayed with you?"
                aria-describedby="together-line-help"
                className="w-full resize-none rounded-control bg-raised px-3.5 py-3 font-display text-base italic text-ink-0 ring-1 ring-inset ring-line-input placeholder:not-italic placeholder:text-ink-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              />
              <p id="together-line-help" className="text-xs text-ink-500">
                Only you, {person.username} and anyone else you&apos;ve watched it with will see it.
              </p>
            </div>
            <button
              type="button"
              onClick={log}
              disabled={busy}
              className="inline-flex h-11 w-full items-center justify-center rounded-full bg-action font-semibold text-on-action hover:bg-action-hover disabled:opacity-60"
            >
              {busy ? "Logging…" : `Add to diary with ${person.username}`}
            </button>
          </>
        )}
      </div>
    </Sheet>
  );
}
