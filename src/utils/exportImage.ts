import { TOKENS } from "@/design/tokens";

/**
 * Render a DOM node to a PNG and hand it to the browser as a download.
 *
 * Four share cards (profile, year, month, "we watched") each carried this
 * same dozen lines. html2canvas is imported lazily because it is ~200 KB and
 * only the person who taps "Save image" pays for it.
 *
 * Everything inside the capture target has to use colours html2canvas can
 * read: Tailwind v4 compiles gradients and `/opacity` modifiers to
 * `color-mix(in oklab, …)`, and html2canvas 1.4 throws outright on an
 * unsupported colour function. Inline rgba only, on the card itself.
 */
export async function exportNodeAsPng(
  node: HTMLElement,
  filename: string,
  opts: { backgroundColor?: string; scale?: number } = {},
): Promise<void> {
  downloadBlob(await renderNodeToPng(node, opts), filename);
}

/** The PNG itself, for a caller that shares it rather than downloading it. */
export async function renderNodeToPng(node: HTMLElement, opts: { backgroundColor?: string; scale?: number } = {}): Promise<Blob> {
  const html2canvas = (await import("html2canvas")).default;
  const canvas = await html2canvas(node, {
    backgroundColor: opts.backgroundColor ?? TOKENS.page,
    // ×2 lands a 540×960 card exactly on 1080×1920 without resampling.
    scale: opts.scale ?? 2,
    useCORS: true,
  });
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) throw new Error("Couldn't render the image");
  return blob;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Hand an image to the person: the system share sheet with the picture in it
 * where the device can (a phone — straight to a story or a chat), a download
 * otherwise. "cancelled" when they closed the sheet.
 */
export async function shareOrSavePng(blob: Blob, filename: string, text?: string): Promise<"shared" | "saved" | "cancelled"> {
  const file = new File([blob], filename, { type: "image/png" });
  if (typeof navigator !== "undefined" && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return "shared";
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return "cancelled";
      // Refused for another reason: fall back to the file.
    }
  }
  downloadBlob(blob, filename);
  return "saved";
}
