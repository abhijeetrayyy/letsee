import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export default function Loading() {
  return (
    <div
      className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-4 text-white"
      aria-busy="true"
      aria-label="Loading person"
    >
      <LoadingSpinner size="lg" className="border-t-white" />
      <p className="text-sm text-neutral-400">Loading profile…</p>
    </div>
  );
}
