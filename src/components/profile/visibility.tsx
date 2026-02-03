"use client";

import React, { useEffect, useState } from "react";

const Visibility: React.FC = () => {
  const [visibility, setVisibility] = useState<string>("public");
  const [profileShowDiary, setProfileShowDiary] = useState(true);
  const [profileShowRatings, setProfileShowRatings] = useState(true);
  const [profileShowPublicReviews, setProfileShowPublicReviews] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch("/api/profile/settings");
        if (res.ok) {
          const data = await res.json();
          if (data.visibility) setVisibility(data.visibility);
          if (typeof data.profile_show_diary === "boolean") setProfileShowDiary(data.profile_show_diary);
          if (typeof data.profile_show_ratings === "boolean") setProfileShowRatings(data.profile_show_ratings);
          if (typeof data.profile_show_public_reviews === "boolean") setProfileShowPublicReviews(data.profile_show_public_reviews);
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
    return (
      <div className="text-sm text-white/60">Loading settings…</div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="profile-visibility" className="text-sm font-medium text-white/80 shrink-0">
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
      <div className="space-y-2 text-sm">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={profileShowDiary}
            onChange={(e) => setProfileShowDiary(e.target.checked)}
            className="rounded border-neutral-600 bg-neutral-800 text-amber-500 focus:ring-amber-500/50"
          />
          <span className="text-white/80">Show diary on profile</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={profileShowRatings}
            onChange={(e) => setProfileShowRatings(e.target.checked)}
            className="rounded border-neutral-600 bg-neutral-800 text-amber-500 focus:ring-amber-500/50"
          />
          <span className="text-white/80">Show ratings on profile</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={profileShowPublicReviews}
            onChange={(e) => setProfileShowPublicReviews(e.target.checked)}
            className="rounded border-neutral-600 bg-neutral-800 text-amber-500 focus:ring-amber-500/50"
          />
          <span className="text-white/80">Show public reviews on profile</span>
        </label>
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
