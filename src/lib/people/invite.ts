/**
 * Who invited you (docs/design/RETHINK.md §3b): remembered on this device from
 * the moment you open their invite, so sign-up can say whose invitation it is
 * and the first five minutes can put them in front of you. Nothing is sent
 * anywhere; it is forgotten after thirty days, the life of an invite.
 */
const KEY = "letsee:invited-by";
const TTL = 30 * 864e5;

export function inviteUrl(username: string, origin = typeof window === "undefined" ? "" : window.location.origin): string {
  return `${origin}/invite?from=${encodeURIComponent(username)}`;
}

/** A username as typed in a link: letters, digits, `_`, `.` and `-`, nothing else. */
export function cleanInviter(value: string | null | undefined): string | null {
  const v = (value ?? "").trim().replace(/^@/, "");
  return /^[A-Za-z0-9_.-]{1,40}$/.test(v) ? v : null;
}

export function rememberInviter(username: string) {
  const clean = cleanInviter(username);
  if (!clean) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ username: clean, at: Date.now() }));
  } catch {
    // Not remembered; the invite still works.
  }
}

export function readInviter(now = Date.now()): string | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const { username, at } = JSON.parse(raw) as { username?: string; at?: number };
    if (!username || !at || now - at > TTL) return null;
    return cleanInviter(username);
  } catch {
    return null;
  }
}

export function forgetInviter() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to forget.
  }
}

/* ── Passes by link (migration 108) ───────────────────────────────────── */

const PASS_KEY = "letsee:pass-link";
const PASS_TTL = 7 * 24 * 60 * 60 * 1000;

/** A share-link token, or null if it isn't one (32 lowercase hex characters). */
export function cleanToken(value: string | null | undefined): string | null {
  const t = (value ?? "").trim().toLowerCase();
  return /^[0-9a-f]{32}$/.test(t) ? t : null;
}

export function passLinkUrl(token: string, origin = typeof window === "undefined" ? "" : window.location.origin): string {
  return `${origin}/invite?t=${token}`;
}

/**
 * Remember a pass opened while signed out, so it can be kept once they join
 * or sign in (ShellBars claims it). On this device only, for a week.
 */
export function rememberPassToken(token: string) {
  try {
    window.localStorage.setItem(PASS_KEY, JSON.stringify({ token, at: Date.now() }));
  } catch {
    // Not remembered; they can open the link again.
  }
}

export function readPassToken(now = Date.now()): string | null {
  try {
    const raw = window.localStorage.getItem(PASS_KEY);
    if (!raw) return null;
    const { token, at } = JSON.parse(raw) as { token?: string; at?: number };
    if (!at || now - at > PASS_TTL) return null;
    return cleanToken(token);
  } catch {
    return null;
  }
}

export function forgetPassToken() {
  try {
    window.localStorage.removeItem(PASS_KEY);
  } catch {
    // Nothing to forget.
  }
}
