/**
 * Share a link the way the device does — the system share sheet where there
 * is one, the clipboard otherwise. Returns what happened so the caller can say
 * so; "cancelled" means the person closed the sheet.
 */
export async function shareOrCopy(input: { title: string; text?: string; url: string }): Promise<"shared" | "copied" | "cancelled" | "failed"> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share(input);
      return "shared";
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return "cancelled";
    }
  }
  try {
    await navigator.clipboard.writeText(input.text ? `${input.text} ${input.url}` : input.url);
    return "copied";
  } catch {
    return "failed";
  }
}
