"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * A fixed-size card, shown at whatever size fits.
 *
 * The recap cards are images — 540px wide so "Save as image" lands exactly on
 * 1080px — and they sat in a sideways scroller, so on a 375px phone the year
 * card was cut off at "rewatches" and the third poster. Here the card keeps
 * its real size and is scaled down to the column's width; the box around it
 * takes the scaled height, so nothing below jumps or overlaps.
 *
 * `full` turns the scaling off: html2canvas measures the node with its
 * ancestors' transforms applied and would capture a shrunken, cropped image,
 * so the caller sets it for the moment of the capture.
 */
export default function FitCard({ width, height, full = false, children }: { width: number; height: number; full?: boolean; children: React.ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  // Before paint, so a card opened in the app never shows at full size first.
  useLayoutEffect(() => {
    const el = frame.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, el.clientWidth / width));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [width]);

  const s = full ? 1 : scale;
  return (
    <div ref={frame} className="w-full overflow-hidden" style={{ height: height * s }}>
      <div className="mx-auto" style={{ width: width * s }}>
        <div style={{ width, height, transform: s === 1 ? undefined : `scale(${s})`, transformOrigin: "top left" }}>{children}</div>
      </div>
    </div>
  );
}

/** Two animation frames: long enough for React to commit `full` and the browser to lay it out. */
export const nextPaint = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
