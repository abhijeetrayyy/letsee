import Link from "@components/ui/AppLink";

/**
 * The frame both detail pages sit in.
 *
 * `MetaChip`, `DetailBlock` and `Section` were defined twice, character for
 * character, at the bottom of MovieDetailClient and TvDetailClient. So was the
 * hero. That duplication is not a tidiness complaint — it is why every hero
 * change this page has been through cost two edits in two files, and why the
 * two pages had already drifted apart (Where to Watch sat in the main column
 * on one and the sidebar on the other).
 *
 * What is shared here is the FRAME, not the content. A film's chips and a
 * series' chips say different things; the box they sit in does not.
 */

export function MetaChip({ icon, label }: { icon?: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-overlay/60 text-xs text-ink-400">
      {icon}
      {label}
    </span>
  );
}

export function DetailBlock({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-ink-500 uppercase tracking-wider">{label}</p>
      <p className="text-sm text-ink-300 mt-0.5">{value}</p>
    </div>
  );
}

export function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-4">
        <div>
          <h2 className="text-xl text-ink-0">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

/**
 * The hero frame, arrived at over several rounds of direction and preserved
 * here exactly as shipped. Every number in it is deliberate:
 *
 * - `overflow-hidden` on the wrapper is load-bearing. The backdrop is
 *   absolutely positioned with its own fixed height, and whenever that height
 *   exceeded the hero's it escaped downward and painted over "Where to Watch".
 *   Clipping here means the two heights never have to be kept in sync by hand.
 * - `opacity-60`, not the original `opacity-20`. At 20% this was texture, not
 *   a banner — you could tell an image was there without seeing what it was
 *   of. Legibility is the gradients' job, so the image no longer has to be
 *   dimmed into uselessness to keep the title readable.
 * - Two gradients doing separate jobs: the vertical one fades the image into
 *   the page so the section below starts on solid ground, the horizontal one
 *   darkens only the left, where the poster and text sit, leaving the right of
 *   the frame bright so the banner is actually visible.
 * - `sm:pt-52` drops the poster and overview far enough down that a real band
 *   of banner reads above them — 265px, measured.
 *
 * The one change: the top padding is now conditional on a backdrop existing.
 * Reserving 208px of headroom for an image that is not there left a slab of
 * empty black on every title TMDB has no backdrop for.
 */
export function TitleHero({
  backdropUrl,
  posterUrl,
  title,
  compactOnPhone = false,
  aside,
  children,
}: {
  backdropUrl: string | null;
  posterUrl: string;
  title: string;
  /**
   * Phase 5, behind ui=v2: on a phone the backdrop and the title art already
   * say which film this is, so the 208 px poster above the title goes and the
   * decision (log it, your people) moves up a screen. "One poster, not three"
   * (docs/design/PAGES.md §5).
   */
  compactOnPhone?: boolean;
  /** Opposite Back, on the same line: the trailer. Costs no height. */
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    // A dark band whatever the app's theme: a film is shown on a screen
    // (tokens.css, data-theme="dark"). The backdrop fills the band exactly —
    // it used to be a fixed 780 px, so on a shorter hero the fade stopped
    // half-way and the image ended in a hard line behind the next section.
    // No overflow-hidden on the band itself: the action bar's menus open
    // downward and would be cut off. The picture layer clips itself, and
    // z-10 lifts the band (menus included) above the sections that follow.
    <div data-theme="dark" className="relative isolate z-10 bg-page text-ink-200">
      {/*
        One picture and two fades, nothing else. A blurred copy of the poster
        used to be screened over the left three-quarters as "the film's light";
        over a real backdrop it left a hazy wash with a hard vertical edge at
        75% of the width, which is what read as a broken overlay. It now only
        stands in when TMDB has no backdrop at all.
      */}
      <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
        {backdropUrl ? (
          /*
            The LCP element on every detail page. `fetchPriority="high"` stops
            the browser spending its first connections on cast avatars instead.
          */
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={backdropUrl} alt="" fetchPriority="high" decoding="async" className="h-full w-full object-cover object-top" />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={posterUrl} alt="" decoding="async" className="h-full w-full scale-125 object-cover opacity-60" style={{ filter: "blur(64px) saturate(1.4)" }} />
        )}
        {/* Readable over any frame: a fade up from the bottom everywhere, a
            fade in from the left on wider screens where the text sits, and a
            light shade under the top bar. */}
        <div className="absolute inset-0 bg-linear-to-t from-page via-page/75 to-page/10" />
        <div className="absolute inset-0 hidden bg-linear-to-r from-page via-page/70 to-transparent sm:block" />
        {/* On a phone the text covers the whole frame, so the whole frame is shaded. */}
        <div className="absolute inset-0 bg-page/50 sm:hidden" />
        <div className="absolute inset-x-0 top-0 h-24 bg-linear-to-b from-page/50 to-transparent" />
      </div>

      <div
        className={`relative max-w-app mx-auto px-4 sm:px-6 lg:px-8 pb-12 sm:pb-16 ${
          backdropUrl ? (compactOnPhone ? "pt-20 sm:pt-52" : "pt-32 sm:pt-52") : "pt-10 sm:pt-14"
        }`}
      >
        {/* A second skip link, for keyboards: the genres, credits and synopsis
            above the actions were nine Tab stops between "Skip to content" and
            Log it. Invisible until focused, like the first. */}
        <a
          href="#title-actions"
          onClick={(e) => {
            // Focus, without leaving #title-actions in the address bar.
            const target = document.getElementById("title-actions");
            if (!target) return;
            e.preventDefault();
            target.focus();
          }}
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-20 focus:rounded-full focus:bg-overlay focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:text-ink-0 focus:shadow-lg focus:ring-1 focus:ring-line-strong"
        >
          Skip to Log it
        </a>
        <div className="mb-8 flex items-center justify-between gap-3">
          <Link href="/app" className="inline-flex items-center gap-1.5 text-sm text-ink-500 transition-colors hover:text-ink-300">
            ← Back
          </Link>
          {aside}
        </div>

        {/*
          Two columns, and a third was tried here and reverted.

          The reasoning for it was sound — the text stops at `max-w-read` and
          left 392px of the hero empty at 1440px — but the fix was worse than
          the fault. A vitals column's height is set by how much TMDB knows
          about the title, and that is always more than a poster and four lines
          of synopsis: measured at 1920px the rail ran 871px against a left
          column that ended at 705px, so it stretched the hero and opened a
          1304x488 hole in the middle of the page. Trading a tall thin gap for
          a vast one is not a trade.

          The vitals are a full-width band below instead, where their height is
          nobody else's problem and their width is the whole page. See
          TitleVitals.
        */}
        <div className="flex flex-col md:flex-row gap-8 md:gap-12">
          <div className={`shrink-0 w-52 sm:w-60 lg:w-64 mx-auto md:mx-0 ${compactOnPhone ? "hidden md:block" : ""}`}>
            {/*
              Intrinsic dimensions, not a size. `w-full` still decides how wide
              it renders; these let the browser reserve the right height before
              the bytes arrive instead of collapsing the column to nothing and
              pushing everything below it down on load. TMDB posters are 2:3,
              and w500 is exactly 500x750.
            */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={posterUrl}
              alt={title}
              width={500}
              height={750}
              className="w-full rounded-2xl shadow-2xl"
            />
          </div>
          <div className="flex-1 min-w-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
