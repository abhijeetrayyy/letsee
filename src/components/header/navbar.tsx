"use client";

import Link from "next/link";
import { IoNotificationsOutline } from "react-icons/io5";
import { FaUser, FaMagnifyingGlass } from "react-icons/fa6";
import { FcFilmReel } from "react-icons/fc";
import { HiHome } from "react-icons/hi2";
import { Film } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase/client";
import SignOut from "../buttons/signOut";
import BurgerMenu from "./BurgerMenu";
import CountrySelector from "./CountrySelector";
import DropdownMenu from "./dropDownMenu";
import MessageButton from "./MessageButton";
import SearchBar from "./searchBar";

interface User {
  id: string;
  username?: string;
  [key: string]: unknown;
}

type NavbarStatus = "loading" | "anon" | "needs_profile" | "ok";

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
        if (!response.ok)
          throw new Error(`Navbar request failed: ${response.status}`);
        const data = await response.json();
        setStatus((data?.status ?? "anon") as NavbarStatus);
        setUser(data?.user ?? null);
      } catch {
        setUser(null);
        setStatus("anon");
      }
    };

    fetchUser();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      fetchUser();
    });
    return () => subscription.unsubscribe();
  }, []);

  if (status === "loading") {
    return (
      <header className="sticky top-0 z-50 w-full nav-glass">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/app"
            className="nav-logo"
          >
            <Film className="w-6 h-6 text-brand-500" />
            <span>LetSee</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 animate-pulse rounded-lg bg-surface-800" />
            <div className="h-9 w-9 animate-pulse rounded-lg bg-surface-800" />
          </div>
        </div>
      </header>
    );
  }

  const isAuthed = status === "ok" || status === "needs_profile";
  const isProfileReady = status === "ok";

  return (
    <header className="sticky top-0 z-50 w-full nav-glass">
      <nav
        className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6"
        aria-label="Main"
      >
        {/* Left: logo + nav links */}
        <div className="flex min-w-0 items-center gap-4">
          <Link
            href="/app"
            className="nav-logo shrink-0"
          >
            <Film className="w-6 h-6 text-brand-500" />
            <span className="hidden sm:inline">LetSee</span>
          </Link>
          <div className="hidden items-center gap-1 sm:flex">
            <Link
              href="/app"
              className="nav-link active"
            >
              <HiHome className="size-4 shrink-0" aria-hidden />
              Home
            </Link>
            {isAuthed && (
              <Link
                href="/app/reel"
                className="nav-link"
              >
                <FcFilmReel className="size-4 shrink-0" aria-hidden />
                Reels
              </Link>
            )}
          </div>
        </div>

        {/* Center: search bar (desktop) */}
        {isProfileReady && (
          <div className="hidden md:block flex-1 max-w-md mx-4">
            <SearchBar />
          </div>
        )}

        {/* Right: actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="hidden sm:block">
            <CountrySelector />
          </div>
          {isAuthed && (
            <Link
              href="/app/reel"
              className="nav-icon-btn sm:hidden"
              aria-label="Reels"
            >
              <FcFilmReel className="size-4" />
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
              className="nav-icon-btn hidden sm:inline-flex"
              aria-label="Notifications"
            >
              <IoNotificationsOutline className="size-4" />
            </Link>
          )}
          {isAuthed && (
            <Link
              href={isProfileReady ? "/app/profile" : "/app/profile/setup"}
              className="nav-icon-btn"
              aria-label={isProfileReady ? "Profile" : "Complete profile"}
            >
              <FaUser className="size-3.5" />
            </Link>
          )}
          {isProfileReady && (
            <Link
              href="/app/search"
              className="nav-icon-btn sm:hidden"
              aria-label="Search"
            >
              <FaMagnifyingGlass className="size-4" />
            </Link>
          )}

          {/* Desktop: auth or user menu */}
          <div className="hidden items-center gap-2 md:flex">
            {status === "anon" && (
              <>
                <Link
                  href="/login"
                  className="nav-link font-medium"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="rounded-full px-4 py-2 text-sm font-semibold text-surface-950 bg-brand-500 hover:bg-brand-400 transition-colors"
                >
                  Sign up
                </Link>
              </>
            )}
            {status === "needs_profile" && (
              <>
                <Link
                  href="/app/profile/setup"
                  className="rounded-full px-4 py-2 text-sm font-semibold text-surface-950 bg-amber-500 hover:bg-amber-400 transition-colors"
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
