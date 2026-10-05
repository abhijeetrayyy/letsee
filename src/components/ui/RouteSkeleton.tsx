"use client";

import { usePathname } from "next/navigation";
import { hintForPath, type NavHint } from "@/lib/nav/pendingNavigation";
import SkeletonCard from "./SkeletonCard";

type Variant = "grid" | "title" | "detail" | "person" | "profile";

type RouteSkeletonProps = {
  /** `detail` is the old name for `title`. */
  variant?: Variant;
  label?: string;
  /** What the tap already showed. Left out, it's read from the tap that led here (a route's loading.tsx). */
  hint?: NavHint;
};

/**
 * The shape of the page that's on its way, drawn the moment it's asked for.
 *
 * Each shape follows its page's real layout — a title's dark band and the
 * poster column beside it, a person's portrait, a profile's face over its
 * numbers — so the page arriving fills in where the eye already is instead of
 * replacing one picture with another. When the tap showed a poster, face or
 * name (lib/nav/pendingNavigation), they're here already: the film you tapped
 * is on screen from the first frame, and only what wasn't on the card waits.
 *
 * Used by the shell while a link's page loads (ui/PendingNavigation) and by the
 * routes' own loading.tsx, so one hands over to the other without a jump.
 */
export default function RouteSkeleton({ variant = "grid", label = "Loading page", hint }: RouteSkeletonProps) {
  const pathname = usePathname();
  const known = hint ?? (pathname ? hintForPath(pathname) : undefined) ?? {};
  const name = known.title ? `Opening ${known.title}` : label;

  return (
    <div role="status" aria-busy="true" aria-label={name} className="min-h-[70vh] bg-page">
      {variant === "title" || variant === "detail" ? (
        <TitleShape hint={known} />
      ) : variant === "person" ? (
        <PersonShape hint={known} />
      ) : variant === "profile" ? (
        <ProfileShape hint={known} />
      ) : (
        <PageShape />
      )}
    </div>
  );
}

function Bone({ className = "" }: { className?: string }) {
  // `active`, not `overlay`: on the light page an overlay is white on paper,
  // and the shapes read as empty cards rather than things on their way.
  return <div aria-hidden className={`animate-pulse rounded-lg bg-active motion-reduce:animate-none ${className}`} />;
}

/** The name from the card, set the way the page will set it; a bar when the card had none. */
function Name({ text, className, bone }: { text?: string; className: string; bone: string }) {
  return text ? <p aria-hidden className={`break-words ${className}`}>{text}</p> : <Bone className={bone} />;
}

/** TitleHero (detail/TitleChrome), compact on a phone as the film and series pages use it. */
function TitleShape({ hint }: { hint: NavHint }) {
  return (
    <>
      <div data-theme="dark" className="relative isolate bg-page text-ink-200">
        <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
          {hint.image && (
            // The poster from the card, blurred into the band the way a title
            // with no backdrop is lit. Already decoded: no request.
            // eslint-disable-next-line @next/next/no-img-element
            // Brighter than the page's own fallback and with no extra shade on a
            // phone: there's no text to keep legible yet, and the film's colour
            // is most of what says which film is coming.
            <img src={hint.image} alt="" className="h-full w-full scale-125 object-cover opacity-80" style={{ filter: "blur(48px) saturate(1.5)" }} />
          )}
          <div className="absolute inset-0 bg-linear-to-t from-page via-page/60 to-transparent" />
          <div className="absolute inset-0 hidden bg-linear-to-r from-page via-page/60 to-transparent sm:block" />
        </div>
        <div className="relative mx-auto max-w-app px-4 pb-12 pt-20 sm:px-6 sm:pb-16 sm:pt-52 lg:px-8">
          <div className="mb-8 flex items-center justify-between gap-3">
            <Bone className="h-4 w-14" />
            <Bone className="h-10 w-28 rounded-full" />
          </div>
          <div className="flex flex-col gap-8 md:flex-row md:gap-12">
            <div className="hidden w-60 shrink-0 md:block lg:w-64">
              {hint.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={hint.image} alt="" className="aspect-2/3 w-full rounded-2xl object-cover shadow-2xl" />
              ) : (
                <Bone className="aspect-2/3 w-full rounded-2xl" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <Name text={hint.title} className="font-display text-4xl leading-tight tracking-tight text-ink-0 sm:text-5xl" bone="h-12 w-3/4" />
              <Bone className="mt-4 h-4 w-56 max-w-full" />
              <Bone className="mt-3 h-4 w-44" />
              <div className="mt-6 max-w-read space-y-2.5">
                <Bone className="h-3.5 w-full" />
                <Bone className="h-3.5 w-full" />
                <Bone className="h-3.5 w-2/3" />
              </div>
              <Bone className="mt-7 h-12 w-full rounded-full sm:w-72" />
              <div className="mt-3 flex gap-2">
                <Bone className="h-12 w-28 rounded-full" />
                <Bone className="size-12 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-app px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Bone key={i} className="h-24 rounded-card" />
          ))}
        </div>
        <Bone className="mt-10 h-6 w-20" />
        <div className="mt-4 flex gap-4 overflow-hidden">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="w-20 shrink-0">
              <Bone className="size-20 rounded-full" />
              <Bone className="mx-auto mt-2 h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/** PersonHero: portrait, name, the line of what they do, then their work. */
function PersonShape({ hint }: { hint: NavHint }) {
  return (
    <div className="mx-auto max-w-app px-4 pb-10 pt-8 sm:px-6 sm:pt-12 lg:px-8">
      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="mx-auto w-32 shrink-0 sm:mx-0 sm:w-50">
          {hint.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={hint.image} alt="" className="aspect-2/3 w-full rounded-2xl object-cover ring-1 ring-line-strong/50" />
          ) : (
            <Bone className="aspect-2/3 w-full rounded-2xl" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <Name text={hint.title} className="font-display text-3xl font-medium tracking-tight text-ink-0 sm:text-5xl" bone="h-10 w-2/3" />
          <Bone className="mt-3 h-4 w-24" />
          <Bone className="mt-2 h-4 w-40" />
          <div className="mt-6 max-w-read space-y-2.5">
            <Bone className="h-3.5 w-full" />
            <Bone className="h-3.5 w-full" />
            <Bone className="h-3.5 w-1/2" />
          </div>
        </div>
      </div>
      <Bone className="mt-12 h-6 w-28" />
      <div className="mt-4 grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}

/** ProfileV2's header: the face in its ring, the name, the numbers; then their four and favourites. */
function ProfileShape({ hint }: { hint: NavHint }) {
  const initial = hint.title?.trim().charAt(0).toUpperCase();
  return (
    <div className="pb-16">
      <div className="mx-auto flex w-full max-w-app flex-col items-center gap-6 px-4 pb-10 pt-12 text-center sm:flex-row sm:items-end sm:px-6 sm:pt-20 sm:text-left lg:px-8">
        <span className="rounded-full p-1 ring-2 ring-accent/70">
          {hint.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={hint.image} alt="" className="size-32 rounded-full object-cover" />
          ) : initial ? (
            <span aria-hidden className="flex size-32 items-center justify-center rounded-full bg-overlay text-4xl font-medium text-ink-200">
              {initial}
            </span>
          ) : (
            <Bone className="size-32 rounded-full" />
          )}
        </span>
        <div className="min-w-0">
          <Name text={hint.title} className="font-display text-5xl leading-tight text-ink-0 sm:text-6xl" bone="h-12 w-48" />
          <div className="mt-5 flex justify-center gap-7 sm:justify-start">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i}>
                <Bone className="mx-auto h-8 w-12 sm:mx-0" />
                <Bone className="mt-1.5 h-3 w-14" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-app space-y-12 px-4 sm:px-6 lg:px-8">
        <div>
          <Bone className="h-7 w-32" />
          <div className="mt-5 grid max-w-read grid-cols-4 gap-3">
            {Array.from({ length: 4 }, (_, i) => (
              <Bone key={i} className="aspect-2/3 rounded-media" />
            ))}
          </div>
        </div>
        <div>
          <Bone className="h-7 w-36" />
          <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {Array.from({ length: 8 }, (_, i) => (
              <Bone key={i} className="aspect-2/3 rounded-media max-sm:[&:nth-child(n+7)]:hidden" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Any other page: a heading, a line, then a grid. */
function PageShape() {
  return (
    <div className="mx-auto max-w-app px-4 py-8 sm:px-6 lg:px-8">
      <Bone className="h-9 w-52" />
      <Bone className="mt-3 h-4 w-80 max-w-full" />
      <Bone className="mt-7 h-12 w-full rounded-xl" />
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
        {Array.from({ length: 8 }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
