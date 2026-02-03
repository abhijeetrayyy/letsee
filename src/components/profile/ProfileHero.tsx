import Link from "next/link";
import { FaEdit } from "react-icons/fa";
import ProfileAvatar from "@components/profile/ProfileAvatar";
import ProfileBanner from "@components/profile/ProfileBanner";

type ProfileHeroProps = {
  username: string;
  avatarSrc: string;
  bannerUrl: string | null;
  tagline: string | null;
  about: string | null;
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
};

export default function ProfileHero({
  username,
  avatarSrc,
  bannerUrl,
  tagline,
  about,
  isOwner,
  followButton,
  messageLink,
  loginPrompt,
  showFollow,
  showMessage,
  showLoginPrompt,
  ShowFollowing,
  ShowFollower,
  visibilityControl,
  userId,
  followingCount,
  followersCount,
}: ProfileHeroProps) {
  const hasBanner = !!bannerUrl?.trim();

  return (
    <section className="relative w-full overflow-visible rounded-2xl isolate">
      {/* Full-bleed cover — banner or gradient; fallback to gradient on image error */}
      <div
        className={`relative w-full overflow-hidden rounded-t-2xl ${hasBanner ? "h-52 sm:h-64 md:h-72" : "h-44 sm:h-52 md:h-60"}`}
      >
        {hasBanner ? (
          <ProfileBanner src={bannerUrl!} />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-neutral-800 via-neutral-800 to-neutral-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/95 via-neutral-950/40 to-transparent" />
      </div>

      {/* Profile content — overlapping the cover only; bottom is padded so it never overlaps next section */}
      <div className="relative px-4 sm:px-6 md:px-8 -mt-24 sm:-mt-28 md:-mt-32 pt-0">
        <div className="max-w-4xl flex flex-col sm:flex-row sm:items-end gap-6">
          {/* Avatar — fallback to default on load error */}
          <div className="shrink-0 w-28 h-28 sm:w-32 sm:h-32 md:w-36 md:h-36 rounded-2xl overflow-hidden border-4 border-neutral-900 shadow-2xl bg-neutral-800 ring-2 ring-white/10">
            <ProfileAvatar
              src={avatarSrc}
              alt={`@${username}`}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Identity + actions */}
          <div className="flex-1 min-w-0 flex flex-col gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white tracking-tight">
                  @{username}
                </h1>
                {isOwner && (
                  <Link
                    href="/app/profile/setup"
                    className="shrink-0 p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/90 transition-colors"
                    aria-label="Edit profile"
                  >
                    <FaEdit className="w-5 h-5" />
                  </Link>
                )}
              </div>
              {tagline && (
                <p className="mt-1.5 text-lg text-white/80 italic">
                  &quot;{tagline}&quot;
                </p>
              )}
              {about && (
                <p className="mt-2 text-white/60 text-sm sm:text-base max-w-xl leading-relaxed">
                  {about}
                </p>
              )}
            </div>

            {isOwner && (
              <div className="pt-2 border-t border-white/10">
                {visibilityControl}
              </div>
            )}

            {/* Actions row: Follow, Message, Following, Followers — own row with clear spacing below */}
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
        {/* Reserved space so hero section always ends below the buttons; prevents overlap with next section */}
        <div className="h-8 sm:h-10 shrink-0" aria-hidden />
      </div>
    </section>
  );
}
