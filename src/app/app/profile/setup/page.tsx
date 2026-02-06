"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/utils/supabase/client";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

const USERNAME_MIN = 2;
const USERNAME_MAX = 15;
const USERNAME_DEBOUNCE_MS = 400;

function sanitizeUsername(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9_]/g, "");
}

function validateUsername(sanitized: string): { valid: boolean; error: string } {
  if (!sanitized) return { valid: false, error: "Enter a username." };
  if (sanitized.length < USERNAME_MIN)
    return { valid: false, error: `At least ${USERNAME_MIN} characters.` };
  if (sanitized.length > USERNAME_MAX)
    return { valid: false, error: `At most ${USERNAME_MAX} characters.` };
  if (sanitized === "null" || sanitized === "undefined")
    return { valid: false, error: "That username isn't allowed." };
  return { valid: true, error: "" };
}

export default function ProfileSetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [alreadyExists, setAlreadyExists] = useState(false);
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [tagline, setTagline] = useState("");
  const [about, setAbout] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [featuredListId, setFeaturedListId] = useState<string | number>("");
  const [pinnedReviewId, setPinnedReviewId] = useState<string | number>("");
  const [lists, setLists] = useState<{ id: number; name: string }[]>([]);
  const [watchedWithReviews, setWatchedWithReviews] = useState<{ id: number; item_name: string }[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchUser() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!mounted) return;
      if (!authUser) {
        setLoading(false);
        return;
      }

      setUser({ id: authUser.id, email: authUser.email ?? "" });

      const { data: profile } = await supabase
        .from("users")
        .select("username, about, tagline, avatar_url, banner_url")
        .eq("id", authUser.id)
        .maybeSingle();

      if (profile) {
        setAlreadyExists(true);
        setUsername((profile.username as string) ?? "");
        setAbout((profile.about as string) ?? "");
        setTagline((profile.tagline as string) ?? "");
        setAvatarUrl((profile.avatar_url as string) ?? "");
        setBannerUrl((profile.banner_url as string) ?? "");
      }

      try {
        const { data: ext } = await supabase
          .from("users")
          .select("featured_list_id, pinned_review_id")
          .eq("id", authUser.id)
          .maybeSingle();
        if (ext) {
          const d = ext as { featured_list_id?: number | null; pinned_review_id?: number | null };
          setFeaturedListId(d.featured_list_id ?? "");
          setPinnedReviewId(d.pinned_review_id ?? "");
        }
      } catch {
        // columns may not exist
      }

      try {
        const [listsRes, reviewsRes] = await Promise.all([
          fetch(`/api/user-lists?userId=${encodeURIComponent(authUser.id)}`, { credentials: "include" }),
          fetch("/api/profile/watched-with-reviews", { credentials: "include" }),
        ]);
        if (listsRes.ok) {
          const listsData = await listsRes.json();
          setLists(listsData.lists ?? []);
        }
        if (reviewsRes.ok) {
          const reviewsData = await reviewsRes.json();
          setWatchedWithReviews(reviewsData.items ?? []);
        }
      } catch {
        // ignore
      }

      setLoading(false);
    }

    fetchUser();
    return () => {
      mounted = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const checkAvailability = useCallback(async (sanitized: string) => {
    if (!sanitized) {
      setUsernameAvailable(null);
      return;
    }
    setCheckingUsername(true);
    try {
      const { data, error } = await supabase
        .from("users")
        .select("username")
        .eq("username", sanitized)
        .maybeSingle();
      setUsernameAvailable(error ? false : !data);
    } catch {
      setUsernameAvailable(false);
    } finally {
      setCheckingUsername(false);
    }
  }, []);

  useEffect(() => {
    const sanitized = sanitizeUsername(username);
    const { valid, error } = validateUsername(sanitized);
    setUsernameError(error);
    setUsernameAvailable(null);

    if (!valid || !sanitized) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => checkAvailability(sanitized), USERNAME_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [username, checkAvailability]);

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(sanitizeUsername(e.target.value));
  };

  const canSubmit =
    user &&
    username &&
    !usernameError &&
    usernameAvailable === true &&
    !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !canSubmit) return;

    setSubmitting(true);
    const toastId = toast.loading(alreadyExists ? "Saving…" : "Creating profile…");

    try {
      const { error } = await supabase.from("users").upsert({
        id: user.id,
        email: user.email,
        username: sanitizeUsername(username),
        about: about.trim() || null,
        tagline: tagline.trim() || null,
        avatar_url: avatarUrl.trim() || null,
        banner_url: bannerUrl.trim() || null,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        toast.error(error.message ?? "Could not save profile.", { id: toastId });
        setSubmitting(false);
        return;
      }

      if (featuredListId || pinnedReviewId) {
        await supabase
          .from("users")
          .update({
            featured_list_id: featuredListId ? Number(featuredListId) : null,
            pinned_review_id: pinnedReviewId ? Number(pinnedReviewId) : null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id);
      }

      toast.success(alreadyExists ? "Profile updated." : "Profile created.", { id: toastId });
      router.push(`/app/profile/${sanitizeUsername(username)}`);
    } catch (err) {
      toast.error((err as Error).message ?? "Something went wrong.", { id: toastId });
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-neutral-950 px-4">
        <LoadingSpinner size="lg" className="border-t-white" />
        <p className="mt-4 text-sm text-neutral-400">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-neutral-950 px-4 text-center">
        <p className="text-neutral-300 mb-4">You need to be logged in to set up your profile.</p>
        <Link
          href="/login"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-white font-medium hover:bg-indigo-500"
        >
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white px-3 sm:px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-xl w-full min-w-0">
        <header className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold">
            {alreadyExists ? "Edit profile" : "Create your profile"}
          </h1>
          <p className="mt-1 text-neutral-400">
            {alreadyExists
              ? "Update your username and details below."
              : "Choose a username and add a few details to get started."}
          </p>
        </header>

        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
          {/* Required: Username */}
          <section className="rounded-xl border border-neutral-700/60 bg-neutral-900/50 p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-white mb-4">
              Username <span className="text-red-400">*</span>
            </h2>
            <div className="space-y-2">
              <input
                type="text"
                id="username"
                value={username}
                onChange={handleUsernameChange}
                placeholder="e.g. movie_fan"
                maxLength={USERNAME_MAX + 10}
                className="w-full min-h-[44px] rounded-lg bg-neutral-800 border border-neutral-600 px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base"
                aria-invalid={!!usernameError}
                aria-describedby="username-hint username-status"
              />
              <p id="username-hint" className="text-xs text-neutral-500">
                Letters, numbers, and underscores only. {USERNAME_MIN}–{USERNAME_MAX} characters.
              </p>
              {usernameError && (
                <p id="username-error" className="text-sm text-red-400">
                  {usernameError}
                </p>
              )}
              <div id="username-status" className="flex items-center gap-2 min-h-6">
                {checkingUsername && (
                  <span className="flex items-center gap-2 text-sm text-neutral-400">
                    <LoadingSpinner size="sm" className="border-t-white" />
                    Checking…
                  </span>
                )}
                {!checkingUsername && usernameAvailable === true && (
                  <span className="text-sm text-emerald-400">Username is available.</span>
                )}
                {!checkingUsername && usernameAvailable === false && username && !usernameError && (
                  <span className="text-sm text-red-400">Username is taken.</span>
                )}
              </div>
            </div>
          </section>

          {/* About you */}
          <section className="rounded-xl border border-neutral-700/60 bg-neutral-900/50 p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-white mb-4">About you</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="tagline" className="block text-sm font-medium text-neutral-300 mb-1.5">
                  Tagline <span className="text-neutral-500">(optional)</span>
                </label>
                <input
                  type="text"
                  id="tagline"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="e.g. Horror by night, rom-coms by day"
                  className="w-full rounded-lg bg-neutral-800 border border-neutral-600 px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label htmlFor="about" className="block text-sm font-medium text-neutral-300 mb-1.5">
                  About <span className="text-neutral-500">(optional)</span>
                </label>
                <textarea
                  id="about"
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  rows={3}
                  placeholder="A short bio..."
                  className="w-full rounded-lg bg-neutral-800 border border-neutral-600 px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
            </div>
          </section>

          {/* Appearance */}
          <section className="rounded-xl border border-neutral-700/60 bg-neutral-900/50 p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Appearance</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="avatar_url" className="block text-sm font-medium text-neutral-300 mb-1.5">
                  Avatar URL <span className="text-neutral-500">(optional)</span>
                </label>
                <input
                  type="url"
                  id="avatar_url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-lg bg-neutral-800 border border-neutral-600 px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label htmlFor="banner_url" className="block text-sm font-medium text-neutral-300 mb-1.5">
                  Banner URL <span className="text-neutral-500">(optional)</span>
                </label>
                <input
                  type="url"
                  id="banner_url"
                  value={bannerUrl}
                  onChange={(e) => setBannerUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-lg bg-neutral-800 border border-neutral-600 px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </section>

          {/* Highlights */}
          <section className="rounded-xl border border-neutral-700/60 bg-neutral-900/50 p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Highlights</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="featured_list" className="block text-sm font-medium text-neutral-300 mb-1.5">
                  Featured list <span className="text-neutral-500">(optional)</span>
                </label>
                <select
                  id="featured_list"
                  value={String(featuredListId)}
                  onChange={(e) => setFeaturedListId(e.target.value ? Number(e.target.value) : "")}
                  className="w-full rounded-lg bg-neutral-800 border border-neutral-600 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">None</option>
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="pinned_review" className="block text-sm font-medium text-neutral-300 mb-1.5">
                  Pinned review <span className="text-neutral-500">(optional)</span>
                </label>
                <select
                  id="pinned_review"
                  value={String(pinnedReviewId)}
                  onChange={(e) => setPinnedReviewId(e.target.value ? Number(e.target.value) : "")}
                  className="w-full rounded-lg bg-neutral-800 border border-neutral-600 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">None</option>
                  {watchedWithReviews.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.item_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-1 rounded-lg bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-neutral-950 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <LoadingSpinner size="sm" className="border-t-white" />
                  Saving…
                </>
              ) : alreadyExists ? (
                "Save changes"
              ) : (
                "Create profile"
              )}
            </button>
            {alreadyExists && (
              <button
                type="button"
                onClick={() => router.back()}
                className="rounded-lg bg-neutral-700 py-3 px-6 font-medium text-white hover:bg-neutral-600 focus:outline-none focus:ring-2 focus:ring-neutral-500"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
