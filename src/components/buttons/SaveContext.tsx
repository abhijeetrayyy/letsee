"use client";

import { useEffect, useState } from "react";
import { Bookmark, CalendarClock, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "@/utils/supabase/client";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import PersonPicker, { type PickedPerson } from "@components/ui/PersonPicker";

/**
 * A save has a why, a when and a who.
 *
 * A bare "want to watch" is an intention with no plan, and intentions convert
 * about half the time; an if-then plan (when, with whom) raises follow-through
 * by d ≈ 0.65, and pleasant things get procrastinated without a deadline
 * (docs/WHY_PEOPLE_COME_BACK.md §3.4, §9 Bet 3). Letterboxd's own users ask
 * for exactly this: "I often forget why I added them."
 *
 * The tap that saves stays one tap. This appears *after* it, beneath the
 * status pills on a title page, as a line you can fill in or ignore. All three
 * fields are optional; each is written only when touched, so nothing here can
 * blank a note typed earlier.
 */

type SaveFor = "tonight" | "weekend" | "someday" | "date";

const FOR_OPTIONS: { value: SaveFor; label: string }[] = [
  { value: "tonight", label: "Tonight" },
  { value: "weekend", label: "This weekend" },
  { value: "date", label: "A date" },
  { value: "someday", label: "Someday" },
];

type Row = {
  save_note: string | null;
  save_for: string | null;
  save_for_date: string | null;
  save_with_user_id: string | null;
  save_with_name: string | null;
};

export default function SaveContext({
  itemId,
  itemType,
  itemName,
  imageUrl,
  genres,
}: {
  itemId: string;
  itemType: "movie" | "tv";
  itemName: string;
  imageUrl?: string | null;
  genres?: string[];
}) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [saveFor, setSaveFor] = useState<SaveFor | null>(null);
  const [forDate, setForDate] = useState("");
  const [who, setWho] = useState<PickedPerson[]>([]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_media_status")
        .select("save_note, save_for, save_for_date, save_with_user_id, save_with_name")
        .eq("user_id", userId)
        .eq("item_id", itemId)
        .eq("item_type", itemType)
        .maybeSingle();
      if (cancelled) return;
      const row = (data ?? null) as Row | null;
      setNote(row?.save_note ?? "");
      setSaveFor((row?.save_for as SaveFor | null) ?? null);
      setForDate(row?.save_for_date ?? "");
      if (row?.save_with_user_id) {
        const { data: u } = await supabase
          .from("users")
          .select("username, avatar_url")
          .eq("id", row.save_with_user_id)
          .maybeSingle();
        if (!cancelled && u?.username) {
          setWho([{ kind: "user", userId: row.save_with_user_id, username: u.username, avatarUrl: u.avatar_url ?? null }]);
        }
      } else if (row?.save_with_name) {
        setWho([{ kind: "name", name: row.save_with_name }]);
      }
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, itemId, itemType]);

  if (!userId) return null;

  const summary = (() => {
    const parts: string[] = [];
    if (saveFor === "tonight") parts.push("for tonight");
    else if (saveFor === "weekend") parts.push("for the weekend");
    else if (saveFor === "date" && forDate) parts.push(`for ${new Date(`${forDate}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`);
    else if (saveFor === "someday") parts.push("someday");
    if (who[0]) parts.push(`with ${who[0].kind === "user" ? who[0].username : who[0].name}`);
    if (note) parts.push(`“${note}”`);
    return parts.join(" · ");
  })();

  const save = async () => {
    setBusy(true);
    try {
      const person = who[0] ?? null;
      const res = await fetch("/api/user-media-status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId,
          itemType,
          status: "watchlist",
          name: itemName,
          imgUrl: imageUrl ?? "",
          genres: genres ?? [],
          saveNote: note,
          saveFor: saveFor,
          saveForDate: saveFor === "date" ? forDate : "",
          saveWithUserId: person?.kind === "user" ? person.userId : "",
          saveWithName: person?.kind === "name" ? person.name : "",
        }),
      });
      if (!res.ok) throw new Error("Couldn't save that.");
      setOpen(false);
      toast.success("Saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-surface-800 bg-surface-900/40 px-4 py-3">
      {!open ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Bookmark className="size-4 shrink-0 text-surface-500" />
          <span className="text-sm text-surface-300">
            {!loaded ? "…" : summary || "Saved. Why, and when?"}
          </span>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="ml-auto rounded-full border border-surface-700 px-3 py-1.5 text-xs text-surface-300 transition hover:border-surface-600 hover:text-white"
          >
            {summary ? "Edit" : "Add a plan"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={280}
            placeholder="Why this one? (“Priya said it’s like Columbo”)"
            className="w-full rounded-lg border border-surface-700 bg-surface-950 px-3 py-2 text-sm text-white placeholder-surface-500 focus:border-brand-500 focus:outline-none"
          />
          <div className="flex flex-wrap items-center gap-2">
            <CalendarClock className="size-3.5 text-surface-500" />
            {FOR_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setSaveFor(saveFor === o.value ? null : o.value)}
                className={`rounded-full border px-3 py-1.5 text-xs transition ${
                  saveFor === o.value
                    ? "border-brand-500/60 bg-brand-500/10 text-brand-300"
                    : "border-surface-700 text-surface-400 hover:border-surface-600 hover:text-white"
                }`}
              >
                {o.label}
              </button>
            ))}
            {saveFor === "date" && (
              <input
                type="date"
                value={forDate}
                onChange={(e) => setForDate(e.target.value)}
                className="rounded-lg border border-surface-700 bg-surface-950 px-2 py-1.5 text-sm text-white focus:border-brand-500 focus:outline-none"
              />
            )}
          </div>
          <div>
            <p className="mb-1.5 text-xs text-surface-400">With, or on the word of</p>
            <PersonPicker value={who} onChange={setWho} multiple={false} placeholder="Who told you, or who you’ll watch it with" />
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={busy}
              className="rounded-full px-3 py-1.5 text-xs text-surface-400 transition hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
            <button type="button" onClick={save} disabled={busy} className="btn-primary rounded-full px-4 py-1.5 text-xs disabled:opacity-50">
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
