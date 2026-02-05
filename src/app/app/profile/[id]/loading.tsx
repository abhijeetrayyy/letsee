import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export default function ProfileLoading() {
  return (
    <div
      className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-4"
      aria-busy="true"
      aria-label="Loading profile"
    >
      <LoadingSpinner size="lg" className="border-t-white shrink-0" />
      <p className="text-sm text-neutral-400 animate-pulse">Loading profile…</p>
    </div>
  );
}
