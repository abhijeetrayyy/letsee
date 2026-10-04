import Link from "next/link";

export default function NotFound() {
  return (
    <div className="bg-hover text-ink-0 w-full h-screen flex justify-center items-center flex-col gap-3">
      <p>Page not found.</p>
      <Link
        href="/app"
        className="px-3 py-2 bg-active rounded-md hover:bg-muted"
      >
        Go to app
      </Link>
    </div>
  );
}
