import Link from "@components/ui/AppLink";
import Faces from "@components/ds/Faces";
import { recapSentence, type RecapPerson } from "@/lib/people/recap";

/**
 * A recap opens with its people (docs/design/PAGES.md §6, recaps): the faces
 * first, then the period in words — "Your September: 9 films, 4 with priya."
 * — and a switcher to the period either side. The numbers that follow are
 * the card's; this is the sentence a person would say.
 */
export default function RecapHeader({
  owner,
  label,
  films,
  series,
  people,
  prev,
  next,
  note,
}: {
  /** "Your" or "ray's". */
  owner: string;
  label: string;
  films: number;
  series: number;
  people: RecapPerson[];
  prev: { href: string; label: string } | null;
  next: { href: string; label: string } | null;
  note?: string;
}) {
  return (
    <header className="mb-8">
      <nav aria-label="Period" className="mb-8 flex items-center justify-between gap-3 text-sm">
        {prev ? (
          <Link href={prev.href} className="text-ink-400 hover:text-ink-0">
            ← {prev.label}
          </Link>
        ) : (
          <span />
        )}
        <span className="font-mono text-xs uppercase tracking-wider text-ink-500">{label}</span>
        {next ? (
          <Link href={next.href} className="text-ink-400 hover:text-ink-0">
            {next.label} →
          </Link>
        ) : (
          <span />
        )}
      </nav>
      {people.length > 0 && <Faces people={people.map((p) => ({ username: p.name, avatarUrl: p.avatarUrl }))} size={44} />}
      <h1 className="mt-4 text-4xl leading-tight text-ink-0">{recapSentence(owner, label, films, series, people[0] ?? null)}</h1>
      {note && <p className="mt-3 text-base text-ink-400">{note}</p>}
    </header>
  );
}
