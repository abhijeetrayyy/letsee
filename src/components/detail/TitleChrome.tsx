import Link from "next/link";

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
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-800/60 text-xs text-surface-400">
      {icon}
      {label}
    </span>
  );
}

export function DetailBlock({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] text-surface-500 uppercase tracking-wider">{label}</p>
      <p className="text-sm text-surface-300 mt-0.5">{value}</p>
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
        <div className="w-1 h-5 rounded-full bg-brand-500" />
        <div>
          <h2 className="text-lg font-bold text-white">{title}</h2>
          {subtitle && <p className="text-xs text-surface-500">{subtitle}</p>}
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
  children,
}: {
  backdropUrl: string | null;
  posterUrl: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden">
      {backdropUrl && (
        <div className="absolute inset-0 h-[780px] overflow-hidden">
          {/*
            The LCP element on every detail page — measured at 1432x780, painted
            at the top of the document — and it was competing on equal footing
            with the thirty-odd other image requests the page fires in the same
            burst. `fetchPriority="high"` is the whole fix: it does not make the
            image smaller or arrive sooner on its own, it stops the browser
            spending its first connections on cast avatars instead.
          */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={backdropUrl}
            alt=""
            fetchPriority="high"
            decoding="async"
            className="w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-surface-950/20 via-surface-950/55 to-surface-950" />
          <div className="absolute inset-0 bg-gradient-to-r from-surface-950 via-surface-950/70 to-surface-950/10" />
        </div>
      )}

      <div
        className={`relative max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pb-20 sm:pb-28 ${
          backdropUrl ? "pt-32 sm:pt-52" : "pt-10 sm:pt-14"
        }`}
      >
        <Link
          href="/app"
          className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-300 mb-8 transition-colors"
        >
          ← Back
        </Link>

        {/*
          Two columns, and a third was tried here and reverted.

          The reasoning for it was sound — the text stops at `max-w-2xl` and
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
          <div className="shrink-0 w-52 sm:w-60 lg:w-64 mx-auto md:mx-0">
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
