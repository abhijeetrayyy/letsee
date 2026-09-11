"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import Avatar from "@components/ui/Avatar";

/**
 * Pick people: those you follow first, anyone by username after, and a plain
 * name for someone who is not here. Used wherever a viewing or a save needs
 * a "who".
 *
 * `/api/share/recipients` already ranks mutuals, then follows, then the rest,
 * and refuses blocked pairs — so the same list that decides who you can send
 * a title to decides who you can name on one.
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

  useEffect(() => {
    if (!focused) return;
    const q = query.trim();
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/share/recipients?q=${encodeURIComponent(q)}`);
        const body = (await res.json()) as { connections?: Result[]; others?: Result[] };
        if (cancelled) return;
        setResults([...(body.connections ?? []), ...(q ? body.others ?? [] : [])].slice(0, 8));
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
  }, [focused, query]);

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
              className="inline-flex items-center gap-1.5 rounded-full border border-surface-700 bg-surface-800/60 py-1 pl-1 pr-2 text-xs text-surface-200"
            >
              <Avatar src={p.kind === "user" ? p.avatarUrl : null} name={pickedLabel(p)} size="xs" />
              {pickedLabel(p)}
              <button
                type="button"
                onClick={() => remove(pickedKey(p))}
                aria-label={`Remove ${pickedLabel(p)}`}
                className="text-surface-500 hover:text-white"
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
            className="w-full rounded-lg border border-surface-700 bg-surface-950 px-3 py-2 text-sm text-white placeholder-surface-500 focus:border-brand-500 focus:outline-none"
          />
          {focused && (results.length > 0 || query.trim()) && (
            <ul className="absolute left-0 right-0 z-20 mt-1 max-h-48 overflow-y-auto rounded-lg border border-surface-800 bg-surface-900 shadow-xl">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => add({ kind: "user", userId: r.id, username: r.username, avatarUrl: r.avatarUrl })}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-surface-200 hover:bg-surface-800"
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
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-surface-400 hover:bg-surface-800"
                  >
                    <Plus className="size-3.5" /> Add “{query.trim()}” as a name
                  </button>
                </li>
              )}
              {searching && (
                <li className="px-3 py-1 text-xs text-surface-600">
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
