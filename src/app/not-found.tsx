import Link from "next/link";

export default function NotFound() {
  return (
    <div className="bg-neutral-700 text-white w-full h-screen flex justify-center items-center flex-col gap-3">
      <p>Page not found.</p>
      <Link
        href="/app"
        className="px-3 py-2 bg-neutral-600 rounded-md hover:bg-neutral-500"
      >
        Go to app
      </Link>
    </div>
  );
}
