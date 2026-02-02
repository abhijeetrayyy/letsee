import Link from "next/link";

export default function PersonIndexPage() {
  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-200 flex items-center justify-center p-6">
      <div className="max-w-xl text-center space-y-4">
        <h1 className="text-2xl font-semibold">Find a person</h1>
        <p className="text-sm text-neutral-400">
          Browse people by searching for a name, then open a person page from
          the results.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/app/search"
            className="rounded-md bg-neutral-700 px-4 py-2 hover:bg-neutral-600"
          >
            Go to Search
          </Link>
          <Link
            href="/app"
            className="rounded-md bg-neutral-700 px-4 py-2 hover:bg-neutral-600"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
