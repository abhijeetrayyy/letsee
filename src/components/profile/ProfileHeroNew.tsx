import Link from "next/link";
import { FaEdit } from "react-icons/fa";
import { FaCalendar, FaFilm, FaTv, FaClock, FaBookmark } from "react-icons/fa6";
import ProfileAvatar from "@components/profile/ProfileAvatar";
import ProfileBanner from "@components/profile/ProfileBanner";
import ProfileCompletenessBar from "./ProfileCompletenessBar";

type ProfileHeroProps = {
  username: string;
  avatarSrc: string;
  bannerUrl: string | null;
  tagline: string | null;
  about: string | null;
  createdAt: string;
  isOwner: boolean;
  followersCount: number;
  followingCount: number;
  followButton: React.ReactNode;
  messageLink: React.ReactNode;
  loginPrompt: React.ReactNode;
  showFollow: boolean;
  showMessage: boolean;
  showLoginPrompt: boolean;
  ShowFollowing: React.ComponentType<{ followingCount: number; userId: string }>;
  ShowFollower: React.ComponentType<{ followerCount: number; userId: string }>;
  visibilityControl: React.ReactNode;
  userId: string;
  stats: {
    watchedCount: number;
    favoriteCount: number;
    watchlistCount: number;
    watchingCount: number;
    watchedThisYear: number;
    movieCount: number;
    tvCount: number;
    episodesCount: number;
  };
  completeness: {
    hasAvatar: boolean;
    hasBanner: boolean;
    hasTagline: boolean;
    hasBio: boolean;
    tasteInFourFilled: boolean;
    hasFeaturedList: boolean;
    hasPinnedReview: boolean;
  };
};

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  } catch {
    return "";
  }
}

export default function ProfileHero({
  username, avatarSrc, bannerUrl, tagline, about,
  createdAt, isOwner,
  followButton, messageLink, loginPrompt,
  showFollow, showMessage, showLoginPrompt,
  ShowFollowing, ShowFollower, visibilityControl,
  userId, followingCount, followersCount, stats, completeness,
}: ProfileHeroProps) {
  const hasBanner = !!bannerUrl?.trim();

  return (
    <section className="relative w-full overflow-visible rounded-2xl isolate">
      {/* Banner */}
      <div className={`relative w-full overflow-hidden rounded-t-2xl ${hasBanner ? "h-48 sm:h-56 md:h-64" : "h-40 sm:h-48 md:h-52"}`}>
        {hasBanner ? (
          <ProfileBanner src={bannerUrl!} />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-surface-800 via-surface-800 to-surface-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-surface-950/95 via-surface-950/30 to-transparent" />
      </div>

      <div className="relative px-4 sm:px-6 md:px-8 -mt-20 sm:-mt-24 md:-mt-28 pt-0">
        <div className="max-w-5xl flex flex-col sm:flex-row sm:items-end gap-5">
          {/* Avatar */}
          <div className="shrink-0 w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-2xl overflow-hidden border-4 border-surface-950 shadow-2xl bg-surface-800 ring-2 ring-brand-500/20">
            <ProfileAvatar src={avatarSrc} alt={`@${username}`} className="w-full h-full object-cover" />
          </div>

          {/* Identity + actions */}
          <div className="flex-1 min-w-0 flex flex-col gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white tracking-tight">
                  @{username}
                </h1>
                {isOwner && (
                  <Link
                    href="/app/profile/setup"
                    className="shrink-0 p-2 rounded-xl bg-surface-800/80 hover:bg-brand-500/20 text-surface-200 hover:text-brand-400 transition-all border border-surface-700/50"
                    aria-label="Edit profile"
                  >
                    <FaEdit className="w-4 h-4" />
                  </Link>
                )}
              </div>

              {tagline && (
                <p className="mt-0.5 text-sm sm:text-base text-white/70 italic">&quot;{tagline}&quot;</p>
              )}

              {/* Meta row: joined date */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5 text-xs text-surface-400">
                {createdAt && (
                  <span className="flex items-center gap-1">
                    <FaCalendar className="w-3 h-3" /> Joined {formatDate(createdAt)}
                  </span>
                )}
              </div>

              {about && (
                <p className="mt-2 text-white/50 text-xs sm:text-sm max-w-xl leading-relaxed line-clamp-2 hover:line-clamp-none transition-all">
                  {about}
                </p>
              )}
            </div>

            {isOwner && (
              <div className="pt-1 border-t border-surface-700/50">{visibilityControl}</div>
            )}

            {/* Actions row */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              {showFollow && <span className="inline-flex shrink-0">{followButton}</span>}
              {showMessage && messageLink}
              {showLoginPrompt && loginPrompt}
              <span className="text-white/40 hidden sm:inline shrink-0" aria-hidden>·</span>
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <ShowFollowing followingCount={followingCount} userId={userId} />
                <ShowFollower followerCount={followersCount} userId={userId} />
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid — 4 columns on mobile, 8 on desktop */}
        <div className="mt-5 grid grid-cols-4 gap-2">
          <StatCard icon={<FaFilm className="w-3.5 h-3.5" />} value={stats.movieCount} label="Movies" accent="text-brand-400" />
          <StatCard icon={<FaTv className="w-3.5 h-3.5" />} value={stats.tvCount} label="TV Shows" accent="text-accent-gold" />
          <StatCard icon={<FaBookmark className="w-3.5 h-3.5" />} value={stats.watchedThisYear} label="This Year" accent="text-green-400" />
          <StatCard icon={<FaClock className="w-3.5 h-3.5" />} value={`${Math.round(stats.movieCount * 2 + stats.episodesCount * 0.75)}h`} label="Hours" accent="text-accent-purple" />
        </div>

        {/* Completeness bar */}
        {isOwner && (
          <div className="mt-3">
            <ProfileCompletenessBar {...completeness} />
          </div>
        )}

        <div className="h-6 shrink-0" aria-hidden />
      </div>
    </section>
  );
}

function StatCard({ icon, value, label, accent }: { icon: React.ReactNode; value: number | string; label: string; accent: string }) {
  return (
    <div className="flex flex-col items-center p-2.5 rounded-xl bg-surface-900/60 border border-surface-800/50 hover:border-surface-700/50 transition-colors">
      <div className={accent}>{icon}</div>
      <span className="text-base font-bold text-white mt-0.5">{value}</span>
      <span className="text-[10px] text-surface-500 uppercase tracking-wider">{label}</span>
    </div>
  );
}
