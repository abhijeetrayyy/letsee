"use client";

import { useState } from "react";
import useSWR from "swr";
import toast from "react-hot-toast";
import { Check, Link2 } from "lucide-react";
import Sheet from "@components/ds/Sheet";
import Avatar from "@components/ui/Avatar";
import TitlePicker, { type PickedTitle } from "@components/ds/TitlePicker";
import { fetchRoomList, searchPeople, type Message, type RoomPerson } from "@/lib/db/rooms";
import { PASS_WORDS_MAX, sendPass, type PassTitle } from "@/lib/db/passes";
import { getPosterUrl } from "@/utils/imageUrl";
import { createPassLink } from "@/lib/db/shareLinks";
import { passLinkUrl } from "@/lib/people/invite";
import { offerLink } from "@components/ds/offerLink";

/**
 * Pass a film to someone (docs/design/RETHINK.md §6, "Give").
 *
 * Opened from a room, the person is already chosen and you pick the film.
 * Opened from a title, the film is chosen and you pick the people — your
 * people first, closest first, and anyone else by username. Words are
 * optional, and they are the part people remember.
 */
export default function PassSheet({
  open,
  onClose,
  me,
  to,
  title,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  me: string;
  /** Fixed recipient, when opened from a room. */
  to?: RoomPerson;
  /** Fixed title, when opened from a title page. */
  title?: PassTitle;
  onSent?: (sent: Message[]) => void;
}) {
  const [picked, setPicked] = useState<PickedTitle | PassTitle | null>(title ?? null);
  const [chosen, setChosen] = useState<RoomPerson[]>(to ? [to] : []);
  const [words, setWords] = useState("");
  const [busy, setBusy] = useState(false);

  const close = () => {
    onClose();
    if (!title) setPicked(null);
    if (!to) setChosen([]);
    setWords("");
  };

  const send = async () => {
    if (!picked || !chosen.length || busy) return;
    setBusy(true);
    const { sent, error } = await sendPass(me, chosen.map((p) => p.id), picked, words);
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(chosen.length === 1 ? `Passed to ${chosen[0].username}` : `Passed to ${chosen.length} people`);
    onSent?.(sent);
    close();
  };

  // A pass by link (migration 108): for anyone, on letsee or not. It opens on
  // the invited door with the film and your words, and joining keeps it.
  const [linking, setLinking] = useState(false);
  const sendLink = async () => {
    if (!picked || linking) return;
    setLinking(true);
    const { token, error } = await createPassLink(
      { itemId: String(picked.itemId), itemType: picked.itemType === "tv" ? "tv" : "movie", itemName: picked.itemName, imageUrl: picked.imageUrl ?? null },
      words,
    );
    setLinking(false);
    if (!token) {
      toast.error(error ?? "Couldn't make the link.");
      return;
    }
    const url = passLinkUrl(token);
    const text = words.trim() ? `${picked.itemName} — “${words.trim()}”` : `I think you'd love ${picked.itemName}.`;
    const result = await offerLink({ title: picked.itemName, text, url }, "Link copied. It works for 30 days.");
    if (result !== "cancelled") close();
  };

  const heading = to ? `Pass a film to ${to.username}` : title ? `Pass ${title.itemName}` : "Pass a film";

  return (
    <Sheet open={open} onClose={close} title={heading} description="It goes in their Up next with your name on it, and you'll hear when they watch it.">
      <div className="grid gap-5">
        {!picked ? (
          <TitlePicker onPick={setPicked} placeholder="Which film or series?" />
        ) : (
          <div className="flex items-center gap-3">
            <img src={getPosterUrl(picked.imageUrl, "w92")} alt="" className="aspect-2/3 w-11 shrink-0 rounded-media bg-hover object-cover" />
            <span className="min-w-0 flex-1 truncate font-display text-lg text-ink-0">{picked.itemName}</span>
            {!title && (
              <button type="button" onClick={() => setPicked(null)} className="rounded-full px-3 py-1.5 text-sm text-ink-400 hover:bg-hover hover:text-ink-0">
                Change
              </button>
            )}
          </div>
        )}

        {!to && picked && <PeoplePicker me={me} chosen={chosen} onChange={setChosen} />}

        {picked && (chosen.length > 0 || !to) && (
          <>
            <div className="grid gap-2">
              <label htmlFor="pass-words" className="text-xs font-medium text-ink-500">
                Why them, why this <span className="text-ink-600">(optional)</span>
              </label>
              <textarea
                id="pass-words"
                rows={2}
                maxLength={PASS_WORDS_MAX}
                value={words}
                onChange={(e) => setWords(e.target.value)}
                placeholder="On a slow Sunday."
                className="w-full resize-none rounded-control bg-raised px-3.5 py-3 font-display text-base italic text-ink-0 ring-1 ring-inset ring-line-input placeholder:not-italic placeholder:text-ink-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              />
            </div>
            {chosen.length > 0 && (
              <button
                type="button"
                onClick={send}
                disabled={busy}
                className="inline-flex h-11 w-full items-center justify-center rounded-full bg-action font-semibold text-on-action hover:bg-action-hover disabled:opacity-60"
              >
                {busy ? "Passing…" : chosen.length === 1 ? `Pass to ${chosen[0].username}` : `Pass to ${chosen.length} people`}
              </button>
            )}
            {!to && (
              <button
                type="button"
                onClick={() => void sendLink()}
                disabled={linking}
                className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-full font-semibold disabled:opacity-60 ${chosen.length > 0 ? "text-ink-200 ring-1 ring-inset ring-line-input hover:bg-hover hover:text-ink-0" : "bg-action text-on-action hover:bg-action-hover"}`}
              >
                <Link2 className="size-4" aria-hidden />
                {linking ? "Making the link…" : "Send as a link — for anyone"}
              </button>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}

function PeoplePicker({ me, chosen, onChange }: { me: string; chosen: RoomPerson[]; onChange: (next: RoomPerson[]) => void }) {
  const { data } = useSWR(["rooms", me], () => fetchRoomList(me), { revalidateOnFocus: false });
  const [query, setQuery] = useState("");
  const { data: found } = useSWR(query.trim().length >= 2 ? ["people-search", me, query.trim()] : null, () => searchPeople(query, me), {
    revalidateOnFocus: false,
  });

  const yours = data?.people ?? [];
  const q = query.trim().replace(/^@/, "").toLowerCase();
  const list: RoomPerson[] = q
    ? [
        ...yours.filter((p) => p.person.username.toLowerCase().includes(q)).map((p) => p.person),
        ...(found ?? []).filter((p) => !yours.some((y) => y.person.id === p.id)),
      ]
    : yours.slice(0, 8).map((p) => p.person);
  const isOn = (p: RoomPerson) => chosen.some((c) => c.id === p.id);
  const toggle = (p: RoomPerson) => onChange(isOn(p) ? chosen.filter((c) => c.id !== p.id) : [...chosen, p]);

  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-xs font-medium text-ink-500">To</legend>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Your people, or anyone by username"
        className="h-11 w-full rounded-control bg-raised px-3.5 text-base text-ink-0 ring-1 ring-inset ring-line-input placeholder:text-ink-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      />
      <ul className="-mx-2 grid gap-0.5">
        {[...chosen.filter((c) => !list.some((p) => p.id === c.id)), ...list].map((p) => (
          <li key={p.id}>
            <button
              type="button"
              aria-pressed={isOn(p)}
              onClick={() => toggle(p)}
              className="flex w-full items-center gap-3 rounded-control px-2 py-1.5 text-left transition-colors hover:bg-hover"
            >
              <Avatar src={p.avatarUrl} name={p.username} size={32} />
              <span className="flex-1 text-base text-ink-0">{p.username}</span>
              <span className={`flex size-6 items-center justify-center rounded-full ${isOn(p) ? "bg-action text-on-action" : "ring-1 ring-inset ring-line-input"}`}>
                {isOn(p) && <Check className="size-3.5" aria-hidden />}
              </span>
            </button>
          </li>
        ))}
        {!q && yours.length === 0 && <li className="px-2 py-2 text-sm text-ink-500">Search for someone by username.</li>}
      </ul>
    </fieldset>
  );
}
