import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export default function ProfileListLoading() {
  return (
    <div className="min-h-screen w-full bg-neutral-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,80,40,0.06),transparent)] pointer-events-none" />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 flex flex-col items-center justify-center min-h-[60vh] gap-4" aria-busy="true" aria-label="Loading discover people">
        <LoadingSpinner size="lg" className="border-t-white shrink-0" />
        <p className="text-sm text-neutral-400 animate-pulse">Loading discover people…</p>
      </div>
    </div>
  );
}
