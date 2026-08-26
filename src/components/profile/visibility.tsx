"use client";

import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import { fetchProfileSettings, updateProfileSettings } from "@/lib/db/profile";

const Visibility: React.FC = () => {
  const [visibility, setVisibility] = useState<string>("public");
  const [profileShowRatings, setProfileShowRatings] = useState(true);
  const [profileShowPublicReviews, setProfileShowPublicReviews] =
    useState(true);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const { user } = useAuth();
  const userId = user?.id ?? null;

  /**
   * `users_self` lets the owner read and update their own row, so both halves
   * of this form talk to Postgres directly — `/api/profile/settings` was a
   * function whose contribution was the cookie read that RLS does not need.
   */
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    (async () => {
      try {
        const data = await fetchProfileSettings(userId);
        if (cancelled || !data) return;
        setVisibility(data.visibility);
        setProfileShowRatings(data.profile_show_ratings);
        setProfileShowPublicReviews(data.profile_show_public_reviews);
      } catch {
        // Leave the defaults on screen; saving still works.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setSaving(true);
    try {
      const message = await updateProfileSettings(userId, {
        visibility,
        profile_show_ratings: profileShowRatings,
        profile_show_public_reviews: profileShowPublicReviews,
      });
      // `alert()` was the previous acknowledgement: it blocks the page, looks
      // like a browser error, and this app has had a toaster mounted the whole
      // time.
      if (message) toast.error(message);
      else toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings.");
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
