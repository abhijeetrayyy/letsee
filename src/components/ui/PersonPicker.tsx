"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import Avatar from "@components/ui/Avatar";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import { fetchRecipients } from "@/lib/db/recipients";

/**
 * Pick people: those you follow first, anyone by username after, and a plain
 * name for someone who is not here. Used wherever a viewing or a save needs
 * a "who".
 *
 * `fetchRecipients` ranks mutuals, then follows, then the rest, and leaves
 * out people you've blocked — so the same list that decides who you can send
 * a title to decides who you can name on one. Read in the browser.
 */

export type PickedPerson =
  | { kind: "user"; userId: string; username: string; avatarUrl: string | null }
  | { kind: "name"; name: string };

export function pickedKey(p: PickedPerson): string {
  return p.kind === "user" ? `u:${p.userId}` : `n:${p.name.toLowerCase()}`;
}

export function pickedLabel(p: PickedPerson): string {
  return p.kind === "user" ? p.username : p.name;
}

type Result = { id: string; username: string; avatarUrl: string | null };

export default function PersonPicker({
  value,
  onChange,
  multiple = true,
  placeholder = "A username, or just a name",
  autoFocus = false,
}: {
  value: PickedPerson[];
  onChange: (next: PickedPerson[]) => void;
  multiple?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [searching, setSearching] = useState(false);
  const [focused, setFocused] = useState(false);
  const { user } = useAuth();
  const me = user?.id ?? null;

  useEffect(() => {
    if (!focused || !me) return;
    const q = query.trim();
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const body = await fetchRecipients(me, q);
        if (cancelled) return;
        setResults([...body.connections, ...(q ? body.others : [])].slice(0, 8));
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [focused, query, me]);

  const add = (p: PickedPerson) => {
    const k = pickedKey(p);
    if (value.some((v) => pickedKey(v) === k)) return;
    onChange(multiple ? [...value, p] : [p]);
    setQuery("");
  };
  const remove = (k: string) => onChange(value.filter((v) => pickedKey(v) !== k));

  const chosen = value;
  const showInput = multiple || value.length === 0;

  return (
    <div>
      {chosen.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {chosen.map((p) => (
            <span
              key={pickedKey(p)}
              className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-overlay/60 py-1 pl-1 pr-2 text-xs text-ink-200"
            >
              <Avatar src={p.kind === "user" ? p.avatarUrl : null} name={pickedLabel(p)} size="xs" />
              {pickedLabel(p)}
              <button
                type="button"
                onClick={() => remove(pickedKey(p))}
                aria-label={`Remove ${pickedLabel(p)}`}
                className="text-ink-500 hover:text-ink-0"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      {showInput && (
        <div className="relative">
          <input
            value={query}
            autoFocus={autoFocus}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              const q = query.trim();
              if (!q) return;
              const exact = results.find((r) => r.username.toLowerCase() === q.toLowerCase());
              if (exact) add({ kind: "user", userId: exact.id, username: exact.username, avatarUrl: exact.avatarUrl });
              else add({ kind: "name", name: q.slice(0, 60) });
            }}
            placeholder={placeholder}
            maxLength={60}
            className="w-full rounded-lg border border-line-strong bg-page px-3 py-2 text-sm text-ink-0 placeholder-ink-500 focus:border-accent-strong focus:outline-none"
          />
          {focused && (results.length > 0 || query.trim()) && (
            <ul className="absolute left-0 right-0 z-20 mt-1 max-h-48 overflow-y-auto rounded-lg border border-line bg-raised shadow-xl">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => add({ kind: "user", userId: r.id, username: r.username, avatarUrl: r.avatarUrl })}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-200 hover:bg-overlay"
                  >
                    <Avatar src={r.avatarUrl} name={r.username} size="xs" />
                    {r.username}
                  </button>
                </li>
              ))}
              {query.trim() && (
                <li>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => add({ kind: "name", name: query.trim().slice(0, 60) })}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-400 hover:bg-overlay"
                  >
                    <Plus className="size-3.5" /> Add “{query.trim()}” as a name
                  </button>
                </li>
              )}
              {searching && (
                <li className="px-3 py-1 text-xs text-ink-600">
                  <Loader2 className="inline size-3 animate-spin" />
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
