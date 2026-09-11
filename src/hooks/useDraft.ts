"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A piece of unfinished writing that survives leaving the page.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 * The composer held its draft in React state and nowhere else. Tapping a cast
 * member, following a link in the thread, or losing the tab discarded whatever
 * had been typed, silently and with no way back. For a product whose whole
 * proposition is asking people to write, that is the cheapest possible way to
 * lose them — and the one failure they will not forgive, because the thing
 * they lost was theirs.
 *
 * ── Why localStorage and not the database ──────────────────────────────────
 * A draft is not content. Writing every keystroke to Postgres would put a
 * network round trip behind a character — the most expensive possible place to
 * spend one — to persist something that has no reader but the person typing it
 * and no value once it is saved. The browser already has the right storage for
 * per-person, per-device, disposable state.
 *
 * ── The rules that keep it from doing harm ─────────────────────────────────
 * A restored draft must never overwrite writing that is already saved without
 * the author seeing it happen, and a draft identical to the saved text is not
 * a draft — it is noise that makes a clean composer look dirty. So a stored
 * value is dropped on read when it matches what the server holds.
 *
 * Every access is wrapped: `localStorage` throws outright in some embedded and
 * privacy-restricted contexts, and a composer that fails to render because
 * storage was unavailable is a worse outcome than one that forgets.
 */

/** Old drafts are not worth restoring, and they are not worth keeping either. */
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

/** Keystrokes are cheap; writes are not. */
const WRITE_DEBOUNCE_MS = 400;

type Stored = { text: string; at: number };

function read(key: string): string | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    if (typeof parsed?.text !== "string" || typeof parsed?.at !== "number") return null;
    if (Date.now() - parsed.at > MAX_AGE_MS) {
      window.localStorage.removeItem(key);
      return null;
    }
    return parsed.text;
  } catch {
    return null;
  }
}

function write(key: string, text: string): void {
  try {
    if (!text) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify({ text, at: Date.now() } as Stored));
  } catch {
    // Quota exceeded, storage disabled, private mode. Losing the draft is the
    // old behaviour, and it is still better than throwing inside a render.
  }
}

export type Draft = {
  /** `null` means "not editing" — the caller falls back to the saved text. */
  value: string | null;
  set: (next: string) => void;
  /** Saved, deleted, or otherwise resolved. Forget it. */
  clear: () => void;
  /** True when a draft was recovered from a previous visit rather than typed. */
  restored: boolean;
};

/**
 * @param key      Stable per piece of writing. Include the author, or one
 *                 person's unsent draft reappears in the next person's
 *                 composer on a shared browser.
 * @param saved    What the server currently holds, so an identical stored
 *                 draft can be discarded rather than presented as unsaved work.
 * @param enabled  False while the saved value is still loading — restoring
 *                 before it arrives would compare against the wrong thing and
 *                 keep a draft that is not actually different.
 */
export function useDraft(key: string | null, saved: string, enabled = true): Draft {
  const [value, setValue] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  // The key a pending write belongs to, so a debounced write cannot land in
  // the wrong slot after the user navigates between two titles quickly.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingKey = useRef<string | null>(null);

  useEffect(() => {
    if (!key || !enabled) return;
    const stored = read(key);
    if (stored === null) return;

    // Identical to what is saved: nothing was actually left unfinished.
    if (stored.trim() === saved.trim()) {
      write(key, "");
      return;
    }
    setValue(stored);
    setRestored(true);
    // `saved` is deliberately not a dependency. This runs once per composer,
    // when the saved text first arrives; re-running it after the user starts
    // typing would overwrite what they are in the middle of writing with the
    // stored copy of what they wrote last time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  const set = useCallback(
    (next: string) => {
      setValue(next);
      setRestored(false);
      if (!key) return;

      if (timer.current) clearTimeout(timer.current);
      pendingKey.current = key;
      timer.current = setTimeout(() => {
        if (pendingKey.current === key) write(key, next);
      }, WRITE_DEBOUNCE_MS);
    },
    [key],
  );

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    pendingKey.current = null;
    setValue(null);
    setRestored(false);
    if (key) write(key, "");
  }, [key]);

  /**
   * Flush on unmount rather than dropping the pending write.
   *
   * Navigating away within the debounce window is not an edge case — it is the
   * exact moment this hook exists for. Without this, the last few hundred
   * milliseconds of typing are the part that gets lost, which is the end of
   * the sentence.
   *
   * One effect, not two. React runs cleanups in declaration order, so a
   * separate "clear the timer" effect declared first would null the ref
   * before this one could read it, and the flush would find nothing pending.
   * The latest text lives in a ref for the same reason: an effect keyed on
   * `value` re-runs — and so re-flushes — on every keystroke, which turns the
   * debounce back into a write per key.
   */
  const latest = useRef<{ key: string | null; value: string | null }>({ key, value });
  latest.current = { key, value };
  useEffect(() => {
    const flush = () => {
      const { key: k, value: v } = latest.current;
      if (!timer.current || !k || v === null) return;
      clearTimeout(timer.current);
      timer.current = null;
      pendingKey.current = null;
      write(k, v);
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  return { value, set, clear, restored };
}
