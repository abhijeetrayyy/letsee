import Link from "@components/ui/AppLink";
import Mark from "@components/ds/Mark";
import Stub from "@components/ds/Stub";
import FrontSearch from "@components/doors/FrontSearch";

/**
 * The front door (docs/design/RETHINK.md §3a): in one screen, a stranger
 * understands this is for them *and someone else*, and starts with that
 * person. One line in the voice, one stub as the example, three plain lines,
 * one action. No trending posters, no counts of users, no testimonials, no
 * feature grid. Signed-in visitors never see it: the proxy sends them Home.
 *
 * Under the action, one way in that needs no account: a search field, for
 * whoever came to look up a single film (owner: "people will come… to find
 * what the movie and TV show is about").
 */
export default function FrontDoor() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-read flex-col justify-center gap-8 px-4 py-16">
      <Mark withName={false} size="lg" />
      <h1 className="text-5xl leading-tight text-ink-0 sm:text-6xl">Keep the films you watch, and the people you watch them with.</h1>
      <Stub
        title="Past Lives"
        poster="https://image.tmdb.org/t/p/w154/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg"
        meta="2023 · at the cinema"
        words="Silent the whole walk home."
        date="Fri 14 Mar"
        people={[{ username: "Priya", avatarUrl: null }]}
      />
      <ul className="flex flex-col gap-2 text-lg leading-snug text-ink-300">
        <li>Log what you watch in one tap, and who you watched it with.</li>
        <li>See what your friends love, and pass them a film.</li>
        <li>Decide tonight’s film together.</li>
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/signup" prefetch className="inline-flex h-12 items-center rounded-full bg-action px-6 text-base font-semibold text-on-action transition-colors hover:bg-action-hover">
          Create an account
        </Link>
        <Link href="/login" prefetch className="inline-flex h-12 items-center rounded-full px-6 text-base font-medium text-ink-200 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover hover:text-ink-0">
          Sign in
        </Link>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-sm text-ink-500">Or just look something up</p>
        <FrontSearch />
      </div>
      <p className="text-sm text-ink-500">
        Bring your history from Letterboxd, Trakt,{" "}
        <Link href="/tv-time" className="text-ink-300 underline decoration-line-input underline-offset-4 hover:text-ink-0">
          TV Time
        </Link>
        , IMDb or Netflix.
      </p>
    </div>
  );
}
