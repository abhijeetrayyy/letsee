import Link from "@components/ui/AppLink";
import { ArrowRight } from "lucide-react";

/**
 * How letsee works (docs/IDEAS_2026-10.md §1.2): five verbs, one card each —
 * what it is, an example in the product's own voice, and the one place to do
 * it. Linked from the account menu and from Home's first week.
 *
 * Static: no session read, nothing fetched, the same page for everyone. A
 * new person meets letsee's words one at a time — room, pass, four, stub,
 * Tonight — and this is the map. Not a tour: five cards read in a minute.
 */
export const metadata = {
  robots: { index: false, follow: false },
  title: "How letsee works",
  description: "Mark, log, pass, decide, remember — letsee in five verbs.",
};

const VERBS: { verb: string; line: string; example: string; where: string; href: string; try: string }[] = [
  {
    verb: "Mark",
    line: "Watched, Watching, Watch later, Favourite — one tap, from any poster's + or under a title. Nothing asks for a date. Started something? On hold and Dropped are right there too, and a series has “Where are you?”: tap a number and everything up to it is marked.",
    example: "Seen it years ago? Tap Watched. That's it.",
    where: "Anywhere there's a poster",
    href: "/app/search",
    try: "Mark something you've seen",
  },
  {
    verb: "Log",
    line: "When you want more than a mark: the day, who was there, your stars and a line. It's under ⋯ on a title — “When, who & stars” — and every entry can become a picture to post or send.",
    example: "Fri 9 Oct · at the cinema · with Priya · ★★★★½",
    where: "⋯ on any title",
    href: "/app/up-next",
    try: "Open what you're watching",
  },
  {
    verb: "Pass",
    line: "Give a title to one person, with a line of why. It waits in their Up next with your name on it, and you hear once they've watched it. Someone not here yet? Pass it by link — it's waiting when they join.",
    example: "“You'll cry at the ending. Watch it anyway.” — from sam",
    where: "Pass to… on any title",
    href: "/app/people",
    try: "See your people",
  },
  {
    verb: "Decide",
    line: "Tonight is choosing together. Each of you picks from what you've saved; it shows where you meet. Or ask your people — “something slow for a rainy Sunday?” — and the answers come back as passes.",
    example: "You and Priya both saved 4 films. Here they are.",
    where: "Tonight, in any room",
    href: "/app/tonight",
    try: "Decide tonight",
  },
  {
    verb: "Remember",
    line: "Your diary, a month, a year, and On this day — led by who you watched with, not by counts. Rooms keep what passed between you: films together, what you gave each other, where you agree and where you split.",
    example: "A year ago, with Priya: Past Lives.",
    where: "Your profile, and each room",
    href: "/app/people",
    try: "Open a room",
  },
];

export default function HowPage() {
  return (
    <div className="min-h-screen w-full bg-page">
      <div className="mx-auto max-w-read px-4 py-10 sm:px-6 sm:py-14">
        <header className="mb-10">
          <p className="font-mono text-xs uppercase tracking-wider text-accent">How letsee works</p>
          <h1 className="mt-2 text-balance font-display text-4xl leading-tight text-ink-0 sm:text-5xl">Five things you do here, and who you do them with.</h1>
          <p className="mt-3 max-w-prose text-base leading-relaxed text-ink-400">
            letsee is a diary of what you watch and the people you watch it with. Everything in it is one of these five.
          </p>
        </header>

        <ol className="grid gap-4">
          {VERBS.map((v) => (
            <li key={v.verb} className="rounded-card border border-line-strong bg-raised p-5 sm:p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="font-display text-3xl text-ink-0">{v.verb}</h2>
                <span className="font-mono text-xs uppercase tracking-wide text-ink-500">{v.where}</span>
              </div>
              <p className="mt-2 text-base leading-relaxed text-ink-300">{v.line}</p>
              <p className="mt-3 border-l-2 border-line-input pl-3 font-display text-lg italic leading-snug text-ink-0">{v.example}</p>
              <Link href={v.href} className="mt-4 inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium text-ink-0 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover">
                {v.try}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </li>
          ))}
        </ol>

        <p className="mt-10 text-sm leading-relaxed text-ink-500">
          Nothing here counts streaks or ranks anyone. Your diary is yours: you choose what anyone else sees, entry by entry, and you can take all of it with you from{" "}
          <Link href="/app/settings#your-data" className="font-medium text-ink-300 underline decoration-line-input underline-offset-4 hover:text-ink-0">
            Your data
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
