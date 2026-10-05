/**
 * A username: 2–15 of a–z, 0–9 and _, lowercase. The database holds every
 * name to this (migration 118), so the browser cleans what's typed to the
 * same shape as you type it and says what's wrong before anything is sent.
 */
export const USERNAME_MIN = 2;
export const USERNAME_MAX = 15;

export function cleanUsername(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, USERNAME_MAX);
}

export function usernameProblem(name: string): string | null {
  if (!name) return "Choose a username.";
  if (name.length < USERNAME_MIN) return `At least ${USERNAME_MIN} characters.`;
  if (name.length > USERNAME_MAX) return `At most ${USERNAME_MAX} characters.`;
  if (name === "null" || name === "undefined") return "That username isn't allowed.";
  return null;
}

/** A save refused by the database, in words. */
export function usernameSaveProblem(error: { code?: string | null } | null | undefined): string {
  if (error?.code === "23505") return "Someone just took that username. Try another.";
  if (error?.code === "23514") return `Use ${USERNAME_MIN}–${USERNAME_MAX} lowercase letters, numbers or _.`;
  return "That didn't save. Try again.";
}
