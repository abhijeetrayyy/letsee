import Link from "next/link";
import type { Metadata } from "next";

/** On the page so `/app/person/[id]` cannot inherit it. */
export const metadata: Metadata = {
  alternates: { canonical: "/app/person" },
};

export default function PersonIndexPage() {
  return (
    <div className="min-h-screen bg-surface-900 text-surface-200 flex items-center justify-center p-6">
      <div className="max-w-xl text-center space-y-4">
        <h1 className="text-2xl font-semibold">Find a person</h1>
        <p className="text-sm text-surface-400">
          Browse people by searching for a name, then open a person page from
          the results.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/app/search"
            className="rounded-md bg-surface-700 px-4 py-2 hover:bg-surface-600"
          >
            Go to Search
          </Link>
          <Link
            href="/app"
            className="rounded-md bg-surface-700 px-4 py-2 hover:bg-surface-600"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
