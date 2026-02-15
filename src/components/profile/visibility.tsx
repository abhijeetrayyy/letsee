"use client";

import React, { useEffect, useState } from "react";

const Visibility: React.FC = () => {
  const [visibility, setVisibility] = useState<string>("public");
  const [profileShowDiary, setProfileShowDiary] = useState(true);
  const [profileShowRatings, setProfileShowRatings] = useState(true);
  const [profileShowPublicReviews, setProfileShowPublicReviews] =
    useState(true);
  const [defaultTvStatus, setDefaultTvStatus] = useState<string>("watching");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch("/api/profile/settings");
        if (res.ok) {
          const data = await res.json();
          if (data.visibility) setVisibility(data.visibility);
          if (typeof data.profile_show_diary === "boolean")
            setProfileShowDiary(data.profile_show_diary);
          if (typeof data.profile_show_ratings === "boolean")
            setProfileShowRatings(data.profile_show_ratings);
          if (typeof data.profile_show_public_reviews === "boolean")
            setProfileShowPublicReviews(data.profile_show_public_reviews);
          if (
            [
              "watching",
              "completed",
              "on_hold",
              "dropped",
              "plan_to_watch",
              "rewatching",
            ].includes(data.default_tv_status ?? "")
          ) {
            setDefaultTvStatus(data.default_tv_status);
          }
        }
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/profile/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visibility,
          profile_show_diary: profileShowDiary,
          profile_show_ratings: profileShowRatings,
          profile_show_public_reviews: profileShowPublicReviews,
          default_tv_status: defaultTvStatus,
        }),
      });
      if (res.ok) {
        alert("Settings saved.");
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data?.error ?? "Failed to save settings.");
      }
    } catch {
      alert("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-white/60">Loading settings…</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label
          htmlFor="profile-visibility"
          className="text-sm font-medium text-white/80 shrink-0"
        >
          Profile visibility
        </label>
        <select
          id="profile-visibility"
          value={visibility}
          onChange={(e) => setVisibility(e.target.value)}
          className="h-9 min-w-40 max-w-48 rounded-lg border border-neutral-600 bg-neutral-800 px-3 py-1.5 text-sm text-white focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50 shrink-0"
        >
          <option value="public">Public</option>
          <option value="followers">Friends only</option>
          <option value="private">Only me</option>
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label
          htmlFor="default-tv-status"
          className="text-sm font-medium text-white/80 shrink-0"
        >
          When I add a TV show to Watched, set status to
        </label>
        <select
          id="default-tv-status"
          value={defaultTvStatus}
          onChange={(e) => setDefaultTvStatus(e.target.value)}
          className="h-9 min-w-40 max-w-48 rounded-lg border border-neutral-600 bg-neutral-800 px-3 py-1.5 text-sm text-white focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50 shrink-0"
        >
          <option value="watching">Watching</option>
          <option value="plan_to_watch">Plan to watch</option>
          <option value="completed">Completed</option>
          <option value="on_hold">On hold</option>
          <option value="dropped">Dropped</option>
          <option value="rewatching">Rewatching</option>
        </select>
      </div>
      <div className="space-y-4 text-sm">
        <p className="text-neutral-400 text-xs max-w-md">
          These control what appears in the &quot;Reviews, ratings &amp;
          diary&quot; section. Diary is only ever visible to you; ratings and
          public reviews can be shown or hidden from visitors.
        </p>
        <div className="space-y-3">
          <label className="flex items-start gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={profileShowDiary}
              onChange={(e) => setProfileShowDiary(e.target.checked)}
              className="rounded border-neutral-600 bg-neutral-800 text-amber-500 focus:ring-amber-500/50 mt-0.5 shrink-0"
            />
            <span className="text-white/80 group-hover:text-white">
              Show my diary on my profile
            </span>
          </label>
          <p className="text-neutral-500 text-xs pl-6 -mt-1.5">
            Diary = your private notes per title (only you see them). On = you
            see them on your profile. Off = they stay hidden on your profile;
            you can still add or edit diary on each title page.
          </p>

          <label className="flex items-start gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={profileShowRatings}
              onChange={(e) => setProfileShowRatings(e.target.checked)}
              className="rounded border-neutral-600 bg-neutral-800 text-amber-500 focus:ring-amber-500/50 mt-0.5 shrink-0"
            />
            <span className="text-white/80 group-hover:text-white">
              Show my ratings to visitors
            </span>
          </label>
          <p className="text-neutral-500 text-xs pl-6 -mt-1.5">
            Ratings = your 1–10 score per title. On = visitors see your scores.
            Off = visitors don’t see them (you still see yours on your own
            profile).
          </p>

          <label className="flex items-start gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={profileShowPublicReviews}
              onChange={(e) => setProfileShowPublicReviews(e.target.checked)}
              className="rounded border-neutral-600 bg-neutral-800 text-amber-500 focus:ring-amber-500/50 mt-0.5 shrink-0"
            />
            <span className="text-white/80 group-hover:text-white">
              Show my public reviews to visitors
            </span>
          </label>
          <p className="text-neutral-500 text-xs pl-6 -mt-1.5">
            Public review = the review you choose to share per title (separate
            from private diary). On = visitors see these. Off = visitors don’t
            (you still see yours on your own profile).
          </p>
        </div>
      </div>
      <button
        type="submit"
        disabled={saving}
        className="h-9 shrink-0 rounded-lg bg-amber-500 px-4 text-sm font-medium text-neutral-900 hover:bg-amber-400 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-neutral-900"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </form>
  );
};

export default Visibility;
