import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export default function Loading() {
  return (
    <div
      className="flex min-h-[50vh] w-full flex-col items-center justify-center gap-4"
      aria-busy="true"
      aria-label="Loading show"
    >
      <LoadingSpinner size="lg" className="border-t-white" />
      <p className="text-sm text-neutral-400">Loading show…</p>
    </div>
  );
}
