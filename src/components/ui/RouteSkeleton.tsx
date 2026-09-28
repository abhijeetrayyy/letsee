import SkeletonCard from "./SkeletonCard";

type RouteSkeletonProps = {
  variant?: "grid" | "detail" | "profile";
  label?: string;
};

const pulse = "animate-pulse rounded-lg bg-surface-800/80";

/** Stable, content-shaped route fallbacks instead of a blank page or spinner. */
export default function RouteSkeleton({ variant = "grid", label = "Loading page" }: RouteSkeletonProps) {
  if (variant === "detail") {
    return (
      <main className="min-h-screen bg-surface-950" aria-busy="true" aria-label={label}>
        <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-[minmax(220px,300px)_1fr]">
            <div className={`${pulse} mx-auto aspect-[2/3] w-full max-w-[300px] rounded-2xl`} />
            <div className="space-y-5 py-3">
              <div className={`${pulse} h-4 w-24`} />
              <div className={`${pulse} h-12 w-4/5`} />
              <div className={`${pulse} h-5 w-2/5`} />
              <div className="space-y-3 pt-4">
                <div className={`${pulse} h-4 w-full`} />
                <div className={`${pulse} h-4 w-full`} />
                <div className={`${pulse} h-4 w-3/4`} />
              </div>
              <div className="flex gap-3 pt-3">
                <div className={`${pulse} h-11 w-32 rounded-xl`} />
                <div className={`${pulse} h-11 w-28 rounded-xl`} />
                <div className={`${pulse} h-11 w-24 rounded-xl`} />
              </div>
            </div>
          </div>
          <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} />)}
          </div>
        </div>
      </main>
    );
  }

  if (variant === "profile") {
    return (
      <main className="min-h-screen bg-surface-950" aria-busy="true" aria-label={label}>
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <div className="flex items-center gap-5 rounded-2xl border border-surface-800/60 bg-surface-900/40 p-5 sm:p-7">
            <div className={`${pulse} size-20 shrink-0 rounded-full sm:size-28`} />
            <div className="w-full max-w-xl space-y-3">
              <div className={`${pulse} h-8 w-48`} />
              <div className={`${pulse} h-4 w-32`} />
              <div className={`${pulse} h-4 w-3/4`} />
            </div>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => <div key={i} className={`${pulse} h-20 rounded-xl`} />)}
          </div>
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} />)}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[70vh] bg-surface-950" aria-busy="true" aria-label={label}>
      <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
        <div className={`${pulse} h-9 w-52`} />
        <div className={`${pulse} mt-3 h-4 w-80 max-w-full`} />
        <div className={`${pulse} mt-7 h-12 w-full rounded-xl`} />
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
          {Array.from({ length: 8 }, (_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    </main>
  );
}
