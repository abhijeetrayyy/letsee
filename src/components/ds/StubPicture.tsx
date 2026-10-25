"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Download, LoaderCircle, Share } from "lucide-react";
import Link from "@components/ui/AppLink";
import Sheet from "@components/ds/Sheet";
import FitCard, { nextPaint } from "@components/ds/FitCard";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import { LIGHT, TOKENS_DARK, alpha } from "@/design/tokens";
import { renderNodeToPng, shareOrSavePng } from "@/utils/exportImage";
import { getPosterUrl } from "@/utils/imageUrl";
import { starGlyphs, stubDay, stubPlace, stubPoster, stubWith, stubWords } from "@/lib/people/stub";

/**
 * A diary entry as a picture (docs/IDEAS_2026-10.md §3.1): a stub — the day,
 * the film, your stars, where, who was there, and a line — to post or send
 * where letsee isn't. Letterboxd grew on screenshots of its grid; a stub is a
 * better unit because a person is on it.
 *
 * Drawn in the browser (html2canvas, loaded on the tap, as the other cards —
 * utils/exportImage): no server work. On a phone it goes straight to the
 * share sheet with the picture in it; elsewhere it saves as a file. Your words
 * are on it only if you say so — on by default only when they're already on
 * your shelf. Inline colours only inside the card (see exportImage).
 */
const W = 540;
/** 4:5 with your words under the tear; square without, so nothing sits empty. */
const H_WORDS = 675;
const H_PLAIN = 540;
/** Behind the ticket, so its notches read as cut out. */
const BACKDROP = TOKENS_DARK.lineStrong;

export default function StubPicture({
  open,
  onClose,
  itemName,
  imageUrl,
  day,
  place,
  people,
  score,
  words,
  wordsPublic,
}: {
  open: boolean;
  onClose: () => void;
  itemName: string;
  imageUrl: string | null | undefined;
  /** yyyy-mm-dd */
  day: string;
  place: string | null | undefined;
  people: string[];
  score: number | null;
  words: string;
  /** The words are already public (Shelf): include them by default. */
  wordsPublic: boolean;
}) {
  const { user } = useAuth();
  const card = useRef<HTMLDivElement>(null);
  const [withWords, setWithWords] = useState(wordsPublic);
  const [capturing, setCapturing] = useState(false);
  const [canShareFiles, setCanShareFiles] = useState(false);

  useEffect(() => {
    if (open) setWithWords(wordsPublic);
  }, [open, wordsPublic]);

  // Whether this device can put a picture in its share sheet (a phone, mostly).
  useEffect(() => {
    try {
      const probe = new File([new Blob()], "p.png", { type: "image/png" });
      setCanShareFiles(typeof navigator.canShare === "function" && navigator.canShare({ files: [probe] }));
    } catch {
      setCanShareFiles(false);
    }
  }, []);

  const line = stubWords(words);
  const showWords = withWords && !!line;
  const H = showWords ? H_WORDS : H_PLAIN;
  const stars = starGlyphs(score);
  const withLine = stubWith(people);
  const poster = stubPoster(getPosterUrl(imageUrl, "w500"));
  const name = user?.username ?? "";
  const slug = itemName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "stub";

  const make = async () => {
    if (!card.current || capturing) return;
    setCapturing(true);
    try {
      await nextPaint();
      const png = await renderNodeToPng(card.current, { backgroundColor: BACKDROP });
      const done = await shareOrSavePng(png, `letsee-${slug}-${day}.png`, `${itemName} — on letsee`);
      if (done === "saved") toast.success("Saved the picture");
    } catch {
      toast.error("Couldn't make the picture. Try again, or take a screenshot of it.");
    } finally {
      setCapturing(false);
    }
  };

  const muted = alpha(TOKENS_DARK.ink0, 0.62);
  const faint = alpha(TOKENS_DARK.ink0, 0.38);

  return (
    <Sheet open={open} onClose={onClose} title="Your stub, as a picture" description="For a story, a chat, anywhere letsee isn't.">
      <div className="grid gap-5">
        <div className="overflow-hidden rounded-card ring-1 ring-inset ring-line-strong">
          <FitCard width={W} height={H} full={capturing}>
            <div ref={card} style={{ width: W, height: H, background: BACKDROP, padding: 22, fontFamily: "var(--font-sans)" }}>
              {/* The ticket: a stub is the half you keep. */}
              <div style={{ position: "relative", height: "100%", borderRadius: 22, background: TOKENS_DARK.page, color: TOKENS_DARK.ink0, display: "flex", flexDirection: "column", padding: 30 }}>
                {/* The screen's glow on the wall: faint, from the top. */}
                <div style={{ position: "absolute", inset: 0, borderRadius: 22, backgroundImage: `linear-gradient(to bottom, ${alpha(TOKENS_DARK.ink0, 0.07)} 0%, ${alpha(TOKENS_DARK.ink0, 0)} 50%)` }} />
                <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "baseline", fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: 2.4 }}>
                  <span style={{ color: TOKENS_DARK.accent }}>LETSEE · DIARY</span>
                  <span style={{ color: muted }}>{stubDay(day)}</span>
                </div>

                <div style={{ position: "relative", display: "flex", gap: 26, marginTop: 26 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={poster}
                    alt=""
                    crossOrigin="anonymous"
                    style={{ width: 184, height: 276, objectFit: "cover", borderRadius: 10, border: `1px solid ${alpha(LIGHT, 0.14)}`, flexShrink: 0 }}
                  />
                  <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 14, paddingTop: 4 }}>
                    <p style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: itemName.length > 28 ? 27 : 33, lineHeight: 1.08 }}>{itemName}</p>
                    {stars && <p style={{ margin: 0, fontSize: 25, letterSpacing: 2, color: TOKENS_DARK.accent, lineHeight: 1 }}>{stars}</p>}
                    <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: 2, color: muted }}>{stubPlace(place).toUpperCase()}</p>
                    {withLine && <p style={{ margin: 0, fontSize: 17, lineHeight: 1.35 }}>{withLine}</p>}
                  </div>
                </div>

                {/* The tear, notched at both edges. */}
                <div style={{ position: "relative", height: 28, margin: "26px -30px 0" }}>
                  <div style={{ position: "absolute", left: -14, top: 0, width: 28, height: 28, borderRadius: 14, background: BACKDROP }} />
                  <div style={{ position: "absolute", right: -14, top: 0, width: 28, height: 28, borderRadius: 14, background: BACKDROP }} />
                  <div style={{ position: "absolute", left: 26, right: 26, top: 13, borderTop: `2px dashed ${alpha(TOKENS_DARK.ink0, 0.22)}` }} />
                </div>

                <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", paddingTop: 20 }}>
                  {showWords ? (
                    <p style={{ margin: 0, fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: line.length > 110 ? 20 : 24, lineHeight: 1.32 }}>“{line}”</p>
                  ) : (
                    <span />
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 15 }}>
                    <span style={{ color: muted }}>{name ? `@${name}` : ""}</span>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: 20, color: faint }}>letsee</span>
                  </div>
                </div>
              </div>
            </div>
          </FitCard>
        </div>

        {!!line && (
          <label className="flex items-center gap-3 text-sm text-ink-200">
            <input type="checkbox" checked={withWords} onChange={(e) => setWithWords(e.target.checked)} className="size-4 accent-current" />
            With your words
            {!wordsPublic && <span className="text-xs text-ink-500">· only you can see them now</span>}
          </label>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2">
          {/* Where the mark matters: one quiet line, never a prompt (IDEAS_2026-10 §6.2). */}
          <Link href="/app/support" className="mr-auto text-xs text-ink-500 underline decoration-line-input underline-offset-4 hover:text-ink-0">
            Pictures without the mark are coming for supporters
          </Link>
          <button type="button" onClick={onClose} className="inline-flex h-11 items-center rounded-full px-4 text-sm font-medium text-ink-300 hover:bg-hover hover:text-ink-0">
            Close
          </button>
          <button
            type="button"
            onClick={() => void make()}
            disabled={capturing}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-action px-5 text-sm font-semibold text-on-action transition-colors hover:bg-action-hover disabled:opacity-60"
          >
            {capturing ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : canShareFiles ? <Share className="size-4" aria-hidden /> : <Download className="size-4" aria-hidden />}
            {canShareFiles ? "Share picture" : "Save picture"}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
