"use client";

import { useState } from "react";
import ProfileAvatar from "@components/profile/ProfileAvatar";
import { Eye, EyeOff, Lock, Users, Globe } from "lucide-react";

interface PreviewAsVisitorProps {
  username: string;
  avatarUrl: string;
  bannerUrl: string;
  tagline: string;
  about: string;
  visibility: string;
  profileShowDiary: boolean;
  profileShowRatings: boolean;
  profileShowPublicReviews: boolean;
  stats: {
    watchedCount: number;
    favoriteCount: number;
    watchlistCount: number;
    followersCount: number;
    followingCount: number;
  };
}

type PreviewRole = "public" | "follower" | "non-follower";

export default function PreviewAsVisitor({
  username,
  avatarUrl,
  bannerUrl,
  tagline,
  about,
  visibility,
  profileShowDiary,
  profileShowRatings,
  profileShowPublicReviews,
  stats,
}: PreviewAsVisitorProps) {
  const [active, setActive] = useState(false);
  const [role, setRole] = useState<PreviewRole>("public");

  if (!active) {
    return (
      <button
        onClick={() => setActive(true)}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-800 hover:bg-surface-700 text-sm text-surface-300 transition-colors border border-surface-700"
      >
        <Eye className="size-4" />
        Preview as visitor
      </button>
    );
  }

  // Determine what each role sees
  const canSeeProfile = () => {
    if (visibility === "public") return true;
    if (visibility === "followers" && role === "follower") return true;
    if (role === "public") return false;
    if (visibility === "followers") return role === "follower";
    return false;
  };

  const canSeeDiary = () => canSeeProfile() && profileShowDiary;
  const canSeeRatings = () => canSeeProfile() && profileShowRatings;
  const canSeeReviews = () => canSeeProfile() && profileShowPublicReviews;

  const isLocked = !canSeeProfile();

  return (
    <div className="mt-4 p-4 rounded-xl border border-surface-700 bg-surface-900/50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Eye className="size-4 text-brand-400" />
          Preview as
        </h3>
        <button
          onClick={() => setActive(false)}
          className="p-1 rounded-lg text-surface-400 hover:text-white hover:bg-surface-800"
        >
          ×
        </button>
      </div>

      {/* Role selector */}
      <div className="flex gap-2 mb-4">
        {[
          { id: "public" as const, label: "Anyone", icon: <Globe className="size-3.5" /> },
          { id: "follower" as const, label: "Follower", icon: <Users className="size-3.5" /> },
          { id: "non-follower" as const, label: "Non-follower", icon: <Lock className="size-3.5" /> },
        ].map((r) => (
          <button
            key={r.id}
            onClick={() => setRole(r.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              role === r.id
                ? "bg-brand-500/20 text-brand-400 border border-brand-500/40"
                : "bg-surface-800 text-surface-400 hover:text-surface-200"
            }`}
          >
            {r.icon}
            {r.label}
          </button>
        ))}
      </div>

      {/* Preview area */}
      <div className="p-4 rounded-lg bg-surface-950 border border-surface-800">
        {isLocked ? (
          <div className="text-center py-8">
            <Lock className="size-10 text-surface-600 mx-auto mb-3" />
            <p className="text-surface-400 font-medium">
              {role === "public"
                ? "This profile is private"
                : "Follow to see this profile"}
            </p>
            <p className="text-surface-600 text-xs mt-1">
              {visibility === "followers" && role === "non-follower"
                ? "Only followers can view this profile"
                : "This account is private"}
            </p>
          </div>
        ) : (
          <>
            {/* Mini hero */}
            <div className="flex items-center gap-3 mb-4">
              <ProfileAvatar
                src={avatarUrl || ""}
                alt={`@${username}`}
                className="w-12 h-12 rounded-xl object-cover"
              />
              <div>
                <p className="text-white font-semibold text-sm">@{username}</p>
                {tagline && (
                  <p className="text-surface-400 text-xs italic">&quot;{tagline}&quot;</p>
                )}
              </div>
            </div>

            {about && (
              <p className="text-surface-400 text-xs mb-4 line-clamp-2">{about}</p>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="text-center p-2 rounded-lg bg-surface-800/50">
                <span className="text-white text-sm font-bold">{stats.watchedCount}</span>
                <span className="text-surface-500 text-[10px] block">Watched</span>
              </div>
              <div className="text-center p-2 rounded-lg bg-surface-800/50">
                <span className="text-white text-sm font-bold">{stats.favoriteCount}</span>
                <span className="text-surface-500 text-[10px] block">Favorites</span>
              </div>
              <div className="text-center p-2 rounded-lg bg-surface-800/50">
                <span className="text-white text-sm font-bold">{stats.followersCount}</span>
                <span className="text-surface-500 text-[10px] block">Followers</span>
              </div>
            </div>

            {/* Visibility indicators */}
            <div className="space-y-1.5">
              <PreviewItem label="Profile" visible={true} />
              <PreviewItem label="Watchlist" visible={canSeeProfile()} />
              <PreviewItem label="Favorites" visible={canSeeProfile()} />
              <PreviewItem label="Film Diary" visible={canSeeDiary()} />
              <PreviewItem label="Ratings" visible={canSeeRatings()} />
              <PreviewItem label="Reviews" visible={canSeeReviews()} />
            </div>
          </>
        )}
      </div>

      <p className="text-surface-500 text-[10px] mt-2">
        This preview shows what a {role === "public" ? "logged-out visitor" : role} would see on your profile.
        Adjust visibility settings to control access.
      </p>
    </div>
  );
}

function PreviewItem({ label, visible }: { label: string; visible: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs py-0.5">
      <span className="text-surface-400">{label}</span>
      {visible ? (
        <Eye className="size-3.5 text-emerald-400" />
      ) : (
        <EyeOff className="size-3.5 text-surface-600" />
      )}
    </div>
  );
}
