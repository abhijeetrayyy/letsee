import { headers } from "next/headers";
import Link from "@components/ui/AppLink";
import { check, clientKey, hashKey, tooFastMessage } from "./guard";

/**
 * The same fair use for pages rendered on the server for each visit (a
 * profile, a month, a year): the "pages" bucket. A page can't answer 429 to a
 * browser in any useful way, so going over shows a short page saying to wait,
 * instead of doing the work.
 *
 * At the top of the page: `const slow = await pageGuard(); if (slow) return slow;`
 */
export async function pageGuard(): Promise<React.ReactElement | null> {
  const key = clientKey(await headers());
  const verdict = check(key, "pages");
  if (verdict.ok) return null;
  if (verdict.started) void import("./report").then(({ reportPenalty }) => reportPenalty(hashKey(key), "pages", null));
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-read flex-col justify-center px-4 py-16">
      <h1 className="text-3xl text-ink-0">One moment</h1>
      <p className="mt-3 text-base leading-relaxed text-ink-400">{tooFastMessage(verdict)}</p>
      <Link href="/app" className="mt-6 inline-flex h-11 w-fit items-center rounded-full bg-action px-5 font-semibold text-on-action hover:bg-action-hover">
        Go home
      </Link>
    </div>
  );
}
