import TonightClient from "./TonightClient";

export const metadata = {
  title: "Tonight",
  alternates: { canonical: "/app/tonight" },
  description: "Who's watching, how long you've got, the services you have. We'll pick.",
};

/**
 * Tonight (docs/design/RETHINK.md, rooms absorb Tonight): who's watching, how
 * long you've got, and one answer with its reason.
 *
 * Static. It used to read the session on the server to decide whether to show
 * the service picker first, which made every visit a server render; that
 * check now happens in the browser under your own row-level security, and
 * the room arrives with people already in it when a link says who
 * (`?with=priya,sam`).
 */
export default function TonightPage() {
  return (
    <div className="mx-auto flex w-full max-w-read flex-col gap-8 px-4 pb-16 pt-6 sm:pt-10">
      <header>
        <h1 className="text-3xl text-ink-0 sm:text-4xl">Tonight</h1>
        <p className="mt-1 text-base text-ink-400">Who&apos;s watching, how long you&apos;ve got — and we&apos;ll pick.</p>
      </header>
      <TonightClient />
    </div>
  );
}
