import Link from "@components/ui/AppLink";
import { Download } from "lucide-react";
import { getAuthUserId } from "@/utils/apiAuth";
import ImportFlow from "@components/import/ImportFlow";

export const dynamic = "force-dynamic";

export const metadata = {
  // No index: it is a signed-in tool, so a crawler only ever sees a redirect
  // or a form it cannot use.
  robots: { index: false, follow: false },
  title: "Bring your history",
  description: "Import from Letterboxd, Trakt, TV Time, Simkl, IMDb or Netflix.",
};

export default async function ImportPage() {
  const userId = await getAuthUserId();

  return (
    <div className="w-full bg-page min-h-screen">
      <div className="max-w-read mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <header className="mb-8">
          <h1 className="text-3xl font-medium text-ink-0 tracking-tight">Bring your history</h1>
          <p className="mt-2 text-ink-400">
            From Letterboxd, Trakt, TV Time, Simkl, IMDb or Netflix — watched, rated, saved,
            every episode and every rewatch, in one go.
          </p>
        </header>

        {userId ? (
          <ImportFlow />
        ) : (
          <div className="rounded-2xl border border-line bg-raised/60 p-8 text-center">
            <h2 className="text-ink-0 font-medium">Sign in to import</h2>
            <p className="text-ink-400 text-sm mt-2">
              We need somewhere to put your films.
            </p>
            <Link href="/login" className="btn-primary text-sm px-5 py-2.5 mt-5 inline-flex">
              Sign in
            </Link>
          </div>
        )}

        {/* The other half of the promise. Import is only trustworthy if leaving
            is equally easy, so the way out is on the same page as the way in. */}
        {userId && (
          <div className="mt-10 border-t border-line pt-6">
            <a
              href="/api/account/export"
              className="inline-flex items-center gap-2 text-sm text-ink-400 hover:text-ink-0 transition"
            >
              <Download className="size-4" />
              Export your LetSee data
            </a>
            <p className="mt-1 text-xs text-ink-600">
              Everything you&apos;ve logged here, as JSON. Yours to take anywhere.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
