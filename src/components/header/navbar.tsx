"use client";

import Link from "next/link";
import { IoNotificationsOutline } from "react-icons/io5";
import { FaUser } from "react-icons/fa6";
import { FcFilmReel } from "react-icons/fc";
import { HiHome } from "react-icons/hi2";
import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase/client";
import SignOut from "../buttons/signOut";
import BurgerMenu from "./BurgerMenu";
import DropdownMenu from "./dropDownMenu";
import MessageButton from "./MessageButton";
import SearchBar from "./searchBar";

interface User {
  id: string;
  username?: string;
  [key: string]: unknown;
}

type NavbarStatus = "loading" | "anon" | "needs_profile" | "ok";

const navIconClass =
  "h-10 w-10 flex items-center justify-center rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700/60 text-neutral-200 transition-colors shrink-0";

export function LogedNavbar() {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<NavbarStatus>("loading");

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch("/api/navbar", {
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`Navbar request failed: ${response.status}`);
        const data = await response.json();
        setStatus((data?.status ?? "anon") as NavbarStatus);
        setUser(data?.user ?? null);
      } catch {
        setUser(null);
        setStatus("anon");
      }
    };

    fetchUser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchUser();
    });
    return () => subscription.unsubscribe();
  }, []);

  if (status === "loading") {
    return (
      <header className="sticky top-0 z-50 w-full border-b border-neutral-800 bg-neutral-900/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/app"
            className="text-xl font-bold text-white transition-colors hover:text-neutral-200"
          >
            Let&apos;s see
          </Link>
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 animate-pulse rounded-xl bg-neutral-800" />
            <div className="h-10 w-10 animate-pulse rounded-xl bg-neutral-800" />
          </div>
        </div>
      </header>
    );
  }

  const isAuthed = status === "ok" || status === "needs_profile";
  const isProfileReady = status === "ok";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-neutral-800 bg-neutral-900/95 shadow-sm backdrop-blur-sm">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6" aria-label="Main">
        {/* Left: logo + nav links */}
        <div className="flex min-w-0 items-center gap-6">
          <Link
            href="/app"
            className="shrink-0 text-xl font-bold tracking-tight text-white transition-colors hover:text-neutral-200"
          >
            Let&apos;s see
          </Link>
          <div className="hidden items-center gap-1 sm:flex">
            <Link
              href="/app"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-white"
            >
              <HiHome className="size-4 shrink-0" aria-hidden />
              Home
            </Link>
            {isAuthed && (
              <Link
                href="/app/reel"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-white"
              >
                <FcFilmReel className="size-4 shrink-0" aria-hidden />
                Reels
              </Link>
            )}
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {isAuthed && (
            <Link
              href="/app/reel"
              className={`${navIconClass} sm:hidden`}
              aria-label="Reels"
            >
              <FcFilmReel className="size-5" />
            </Link>
          )}
          {isProfileReady && user && (
            <span className="hidden sm:inline-flex">
              <MessageButton userId={user.id} />
            </span>
          )}
          {isProfileReady && user && (
            <Link
              href="/app/notification"
              className={`${navIconClass} hidden sm:inline-flex`}
              aria-label="Notifications"
            >
              <IoNotificationsOutline className="size-5" />
            </Link>
          )}
          {isAuthed && (
            <Link
              href={isProfileReady ? "/app/profile" : "/app/profile/setup"}
              className={navIconClass}
              aria-label={isProfileReady ? "Profile" : "Complete profile"}
            >
              <FaUser className="size-4" />
            </Link>
          )}
          {isProfileReady && (
            <div className="hidden w-64 max-w-[40vw] sm:block lg:w-72">
              <SearchBar />
            </div>
          )}

          {/* Desktop: auth or user menu */}
          <div className="hidden items-center gap-2 md:flex">
            {status === "anon" && (
              <>
                <Link
                  href="/login"
                  className="rounded-xl px-4 py-2.5 text-sm font-medium text-white bg-neutral-700 hover:bg-neutral-600 transition-colors"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="rounded-xl px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 transition-colors"
                >
                  Sign up
                </Link>
              </>
            )}
            {status === "needs_profile" && (
              <>
                <Link
                  href="/app/profile/setup"
                  className="rounded-xl px-4 py-2.5 text-sm font-medium text-white bg-amber-600 hover:bg-amber-500 transition-colors"
                >
                  Complete profile
                </Link>
                <div className="min-w-32">
                  <SignOut />
                </div>
              </>
            )}
            {status === "ok" && user && <DropdownMenu user={user} />}
          </div>

          <BurgerMenu status={status} username={user?.username} />
        </div>
      </nav>
    </header>
  );
}
