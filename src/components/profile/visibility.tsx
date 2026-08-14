"use client";

import React, { useEffect, useState } from "react";

const Visibility: React.FC = () => {
  const [visibility, setVisibility] = useState<string>("public");
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
          if (typeof data.profile_show_ratings === "boolean")
            setProfileShowRatings(data.profile_show_ratings);
          if (typeof data.profile_show_public_reviews === "boolean")
            setProfileShowPublicReviews(data.profile_show_public_reviews);
          if (
            ["watchlist", "watching", "watched", "on_hold", "dropped"].includes(
              data.default_tv_status ?? "",
            )
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
          className="h-9 min-w-40 max-w-48 rounded-lg border border-surface-600 bg-surface-800 px-3 py-1.5 text-sm text-white focus:border-brand-500/50 focus:outline-none focus:ring-1 focus:ring-brand-500/50 shrink-0"
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
          className="h-9 min-w-40 max-w-48 rounded-lg border border-surface-600 bg-surface-800 px-3 py-1.5 text-sm text-white focus:border-brand-500/50 focus:outline-none focus:ring-1 focus:ring-brand-500/50 shrink-0"
        >
          <option value="watchlist">Watchlist</option>
          <option value="watching">Watching</option>
          <option value="watched">Watched</option>
          <option value="on_hold">On hold</option>
          <option value="dropped">Dropped</option>
        </select>
      </div>
      <div className="space-y-4 text-sm">
        <p className="text-surface-400 text-xs max-w-md">
          Your private notes are never shown to anyone else. These control what
          visitors see of your ratings and public reviews.
        </p>
        <div className="space-y-3">
          <label className="flex items-start gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={profileShowRatings}
              onChange={(e) => setProfileShowRatings(e.target.checked)}
              className="rounded border-surface-600 bg-surface-800 text-brand-500 focus:ring-brand-500/50 mt-0.5 shrink-0"
            />
            <span className="text-white/80 group-hover:text-white">
              Show my ratings to visitors
            </span>
          </label>
          <p className="text-surface-500 text-xs pl-6 -mt-1.5">
            Ratings = your 1–10 score per title. On = visitors see your scores.
            Off = visitors don’t see them (you still see yours on your own
            profile).
          </p>

          <label className="flex items-start gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={profileShowPublicReviews}
              onChange={(e) => setProfileShowPublicReviews(e.target.checked)}
              className="rounded border-surface-600 bg-surface-800 text-brand-500 focus:ring-brand-500/50 mt-0.5 shrink-0"
            />
            <span className="text-white/80 group-hover:text-white">
              Show my public reviews to visitors
            </span>
          </label>
          <p className="text-surface-500 text-xs pl-6 -mt-1.5">
            Public review = the review you choose to share per title (separate
            from private diary). On = visitors see these. Off = visitors don’t
            (you still see yours on your own profile).
          </p>
        </div>
      </div>
      <button
        type="submit"
        disabled={saving}
        className="h-9 shrink-0 rounded-lg bg-brand-500 px-4 text-sm font-medium text-surface-950 hover:bg-brand-400 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2 focus:ring-offset-surface-950"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </form>
  );
};

export default Visibility;
