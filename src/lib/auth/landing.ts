import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Where someone goes once an email link has signed them in.
 *
 * Without a username they haven't finished setting up, so welcome comes first
 * and carries `next` through to the end of it. If the profile can't be read,
 * `next` is used as it is and the middleware decides — a slow database is no
 * reason to send someone who's done back through setup.
 */
export async function landingFor(supabase: SupabaseClient, userId: string | null | undefined, next: string): Promise<string> {
  if (!userId) return "/login";
  const { data, error } = await supabase.from("users").select("username").eq("id", userId).maybeSingle();
  if (error || data?.username) return next;
  const carry = next !== "/app" && !next.startsWith("/app/welcome") ? `?next=${encodeURIComponent(next)}` : "";
  return `/app/welcome${carry}`;
}

/** `&next=…` to keep on the sign-in page a link failed onto, so signing in still gets you there. */
export function andNext(next: string): string {
  return next && next !== "/app" ? `&next=${encodeURIComponent(next)}` : "";
}
