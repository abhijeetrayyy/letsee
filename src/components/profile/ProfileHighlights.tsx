import Link from "next/link";
import { HiOutlineBookmark, HiOutlineStar } from "react-icons/hi2";

type FeaturedList = { id: number; name: string };
type PinnedReview = { item_id: string; item_type: string; item_name: string };

export default function ProfileHighlights({
  featuredList,
  pinnedReview,
}: {
  featuredList: FeaturedList | null;
  pinnedReview: PinnedReview | null;
}) {
  if (!featuredList && !pinnedReview) return null;

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {featuredList && (
        <Link
          href={`/app/lists/${featuredList.id}`}
          className="group flex items-center gap-4 p-4 sm:p-5 rounded-2xl border border-neutral-700/60 bg-neutral-800/50 hover:bg-neutral-800 hover:border-amber-500/30 transition-all"
        >
          <span className="shrink-0 w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 group-hover:bg-amber-500/30 transition-colors">
            <HiOutlineBookmark className="w-6 h-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              Featured list
            </p>
            <p className="font-semibold text-white truncate mt-0.5 group-hover:text-amber-400/90 transition-colors">
              {featuredList.name}
            </p>
          </div>
          <span className="shrink-0 text-neutral-500 group-hover:text-amber-400/80 text-sm font-medium transition-colors">
            View →
          </span>
        </Link>
      )}
      {pinnedReview && (
        <Link
          href={`/app/${pinnedReview.item_type}/${pinnedReview.item_id}`}
          className="group flex items-center gap-4 p-4 sm:p-5 rounded-2xl border border-neutral-700/60 bg-neutral-800/50 hover:bg-neutral-800 hover:border-amber-500/30 transition-all"
        >
          <span className="shrink-0 w-12 h-12 rounded-xl bg-rose-500/20 flex items-center justify-center text-rose-400 group-hover:bg-rose-500/30 transition-colors">
            <HiOutlineStar className="w-6 h-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              Pinned review
            </p>
            <p className="font-semibold text-white truncate mt-0.5 group-hover:text-rose-400/90 transition-colors">
              {pinnedReview.item_name}
            </p>
          </div>
          <span className="shrink-0 text-neutral-500 group-hover:text-rose-400/80 text-sm font-medium transition-colors">
            View →
          </span>
        </Link>
      )}
    </section>
  );
}
