/**
 * Where an auth step may send you next.
 *
 * `next` rides in links people are sent — sign-in, the confirmation email, a
 * reset — so it's attacker-controlled. Only a path on this site, inside the
 * app or an invitation, is followed. `//evil.com` and `/\evil.com` are paths a
 * browser reads as another host, so they're refused too, as is anything with a
 * scheme. Whatever's refused becomes the fallback, never an error: a bad link
 * still signs you in, it just lands you at home.
 */
const ALLOWED = [/^\/app(?:[/?#]|$)/, /^\/invite(?:[/?#]|$)/];

export function safeNext(raw: string | null | undefined, fallback = "/app"): string {
  if (!raw) return fallback;
  const next = raw.trim();
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  // Control characters (a tab or newline inside a path) can be stripped by a
  // browser into something that's no longer a path.
  if (/[\u0000-\u001f\u007f]/.test(next)) return fallback;
  return ALLOWED.some((re) => re.test(next)) ? next : fallback;
}

/** `?next=` for a link to an auth page, or nothing when there's nowhere special to return to. */
export function nextQuery(next: string | null | undefined): string {
  const safe = safeNext(next, "");
  return safe && safe !== "/app" ? `?next=${encodeURIComponent(safe)}` : "";
}
