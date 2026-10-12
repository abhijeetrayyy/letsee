"use client";

import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { Download, LoaderCircle, Share } from "lucide-react";
import Sheet from "@components/ds/Sheet";
import FitCard, { nextPaint } from "@components/ds/FitCard";
import { LIGHT, TOKENS_DARK, alpha } from "@/design/tokens";
import { renderNodeToPng, shareOrSavePng } from "@/utils/exportImage";
import { getPosterUrl } from "@/utils/imageUrl";
import { stubPoster } from "@/lib/people/stub";
import { roomMonthLine, type RoomMonth } from "@/lib/people/ourMonth";

/**
 * Our month, as a picture (docs/IDEAS_2026-10.md §3.3): a room's month for
 * two — the films you watched together and what you passed each other — to
 * send them, or post. Drawn in the browser like a stub (ds/StubPicture);
 * initials rather than photos, so nothing from another host can stop the
 * capture. Inline colours only inside the card (utils/exportImage).
 */
const W = 540;
const H = 675;
const BACKDROP = TOKENS_DARK.lineStrong;

export default function OurMonthPicture({ open, onClose, month, me, them }: { open: boolean; onClose: () => void; month: RoomMonth; me: string; them: string }) {
  const card = useRef<HTMLDivElement>(null);
  const [capturing, setCapturing] = useState(false);
  const canShareFiles = typeof navigator !== "undefined" && typeof navigator.canShare === "function";
  const films = month.films.slice(0, 6);
  const passes = month.passes.slice(0, 3);
  const name = month.label.split(" ")[0];

  const make = async () => {
    if (!card.current || capturing) return;
    setCapturing(true);
    try {
      await nextPaint();
      const png = await renderNodeToPng(card.current, { backgroundColor: BACKDROP });
      const done = await shareOrSavePng(png, `letsee-${me}-${them}-${month.month}.png`, `${month.label}, with ${them} — on letsee`);
      if (done === "saved") toast.success("Saved the picture");
    } catch {
      toast.error("Couldn't make the picture. Try again, or take a screenshot of it.");
    } finally {
      setCapturing(false);
    }
  };

  const muted = alpha(TOKENS_DARK.ink0, 0.62);
  const disc = (letter: string, edge: string) => (
    <span style={{ width: 34, height: 34, borderRadius: 17, background: TOKENS_DARK.active, color: TOKENS_DARK.ink0, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600, border: `2px solid ${edge}` }}>
      {letter.charAt(0).toUpperCase()}
    </span>
  );

  return (
    <Sheet open={open} onClose={onClose} title={`${month.label}, with ${them}`} description="Your month together, as a picture — to send them, or post.">
      <div className="grid gap-5">
        <div className="overflow-hidden rounded-card ring-1 ring-inset ring-line-strong">
          <FitCard width={W} height={H} full={capturing}>
            <div ref={card} style={{ width: W, height: H, background: BACKDROP, padding: 22, fontFamily: "var(--font-sans)" }}>
              <div style={{ position: "relative", height: "100%", borderRadius: 22, background: TOKENS_DARK.page, color: TOKENS_DARK.ink0, display: "flex", flexDirection: "column", padding: 30 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: 2.4 }}>
                  <span style={{ color: TOKENS_DARK.accent }}>LETSEE · {month.label.toUpperCase()}</span>
                  <span style={{ display: "inline-flex" }}>
                    {disc(me, TOKENS_DARK.page)}
                    <span style={{ marginLeft: -10 }}>{disc(them, TOKENS_DARK.page)}</span>
                  </span>
                </div>
                <p style={{ margin: "22px 0 0", fontFamily: "var(--font-display)", fontSize: 38, lineHeight: 1.05 }}>{name}, together</p>
                <p style={{ margin: "8px 0 0", fontSize: 16, color: muted }}>
                  {me} &amp; {them} · {roomMonthLine(month)}
                </p>

                {films.length > 0 ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 24 }}>
                    {films.map((f) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={f.viewingId}
                        src={stubPoster(getPosterUrl(f.imageUrl, "w342"))}
                        alt=""
                        crossOrigin="anonymous"
                        style={{ width: "100%", aspectRatio: "2 / 3", objectFit: "cover", borderRadius: 8, border: `1px solid ${alpha(LIGHT, 0.14)}` }}
                      />
                    ))}
                  </div>
                ) : (
                  <div style={{ flex: 1 }} />
                )}

                <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 6, paddingTop: 18 }}>
                  {passes.map((p) => (
                    <p key={p.id} style={{ margin: 0, fontSize: 15, color: muted }}>
                      {p.fromMe ? `${me} passed ${them} ` : `${them} passed ${me} `}
                      <span style={{ fontFamily: "var(--font-display)", fontSize: 17, color: TOKENS_DARK.ink0 }}>{p.itemName}</span>
                    </p>
                  ))}
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: 20, color: alpha(TOKENS_DARK.ink0, 0.38) }}>letsee</span>
                  </div>
                </div>
              </div>
            </div>
          </FitCard>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
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
