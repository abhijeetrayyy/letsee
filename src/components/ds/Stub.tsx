import Faces from "@components/ds/Faces";

/**
 * The stub: a viewing as a ticket (docs/design/SYSTEM.md §8, `Stub`). The
 * product's signature object — and the perforation and the stamp appear
 * nowhere else.
 *
 * Left: the poster, the title in the voice, one meta line, the person's words
 * in italic. A dashed perforation with two notches. Right, the tear-off: the
 * date in the stamp, the faces of who was there, and **Admit 2** when two were.
 */
export default function Stub({
  title,
  poster,
  meta,
  words,
  date,
  people = [],
  size = "full",
}: {
  title: string;
  poster: string;
  meta?: string;
  words?: string;
  /** Already formatted: "FRI 14 MAR". */
  date: string;
  people?: { username: string; avatarUrl: string | null }[];
  size?: "full" | "compact";
}) {
  const admits = people.length + 1;
  const compact = size === "compact";
  return (
    <div className="relative flex w-full max-w-sheet overflow-hidden rounded-card bg-raised ring-1 ring-inset ring-line-strong">
      <div className={`flex min-w-0 flex-1 gap-3.5 ${compact ? "p-3" : "p-4"}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={poster} alt="" className={`aspect-2/3 shrink-0 rounded-media bg-hover object-cover ${compact ? "w-12" : "w-16"}`} />
        <div className="min-w-0 self-center">
          <p className={`truncate font-display text-ink-0 ${compact ? "text-base" : "text-xl"}`}>{title}</p>
          {meta && <p className="mt-0.5 truncate text-xs text-ink-500">{meta}</p>}
          {words && !compact && <p className="mt-2 line-clamp-2 font-display text-base italic leading-snug text-ink-300">“{words}”</p>}
        </div>
      </div>

      {/* The perforation: a dashed rule with a notch cut at each end. */}
      <div aria-hidden className="relative w-px shrink-0 border-l border-dashed border-line-strong">
        <span className="absolute -left-2 -top-2 size-4 rounded-full bg-page ring-1 ring-inset ring-line-strong" />
        <span className="absolute -bottom-2 -left-2 size-4 rounded-full bg-page ring-1 ring-inset ring-line-strong" />
      </div>

      <div className={`flex shrink-0 flex-col items-center justify-center gap-2 ${compact ? "w-20 p-2" : "w-24 p-3"}`}>
        <span className="text-center font-mono text-xs font-medium uppercase leading-tight tracking-wider text-ink-300">{date}</span>
        {people.length > 0 && <Faces people={people} size={compact ? 20 : 24} />}
        {admits > 1 && <span className="font-mono text-xs uppercase tracking-wider text-ink-500">Admit {admits}</span>}
      </div>
    </div>
  );
}
