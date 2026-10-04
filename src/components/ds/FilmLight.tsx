/**
 * The film's light (docs/design/SYSTEM.md §1.5): a heavily blurred copy of a
 * poster the page already shows, screened behind a card. Same URL, so no extra
 * request; it is the only place hue may fill space.
 */
export default function FilmLight({ src, strength = 0.35 }: { src: string; strength?: number }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        decoding="async"
        className="absolute -left-1/4 top-0 h-full w-full object-cover mix-blend-screen"
        style={{ filter: "blur(70px) saturate(1.35)", opacity: strength, transform: "translateZ(0)" }}
      />
    </div>
  );
}
