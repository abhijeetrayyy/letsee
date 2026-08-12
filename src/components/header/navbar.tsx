"use client";

import Link from "next/link";
import { FaMagnifyingGlass } from "react-icons/fa6";
import { FiBell, FiMessageSquare, FiGlobe } from "react-icons/fi";
import { Film } from "lucide-react";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import SignOut from "../buttons/signOut";
import BurgerMenu from "./BurgerMenu";
import CountrySelector from "./CountrySelector";
import DropdownMenu from "./dropDownMenu";
import MessageButton from "./MessageButton";
import NotificationBell from "./NotificationBell";
import SearchBar from "./searchBar";

export function LogedNavbar() {
  const { status, user } = useAuth();

  if (status === "loading") {
    return (
      <header className="sticky top-0 z-50 w-full nav-glass">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/app" className="nav-logo">
            <Film className="w-6 h-6 text-brand-500" />
            <span>LetSee</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 animate-pulse rounded-lg bg-surface-800" />
            <div className="h-9 w-9 animate-pulse rounded-full bg-surface-800" />
          </div>
        </div>
      </header>
    );
  }

  const isAuthed = status === "ok" || status === "needs_profile";

  return (
    <header className="sticky top-0 z-50 w-full nav-glass">
      <nav
        className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6"
        aria-label="Main"
      >
        {/* Logo */}
        <Link href="/app" className="nav-logo shrink-0 mr-1">
          <Film className="w-6 h-6 text-brand-500" />
          <span className="hidden sm:inline">LetSee</span>
        </Link>

        {/* Search bar — fills available space */}
        <div className="hidden sm:flex flex-1 max-w-lg mx-auto">
          <SearchBar />
        </div>

        {/* Right: action icons */}
        <div className="flex items-center gap-1">
          {/* Country selector (compact) */}
          <div className="hidden sm:block">
            <CountrySelector />
          </div>

          {/* Mobile search trigger */}
          <Link href="/app/search" className="nav-icon-btn sm:hidden" aria-label="Search">
            <FaMagnifyingGlass className="size-4" />
          </Link>

          {isAuthed && (
            <>
              {/* Notifications */}
              {status === "ok" && user && (
                <NotificationBell userId={user.id} />
              )}

              {/* Messages */}
              {status === "ok" && user && (
                <MessageButton userId={user.id} />
              )}
            </>
          )}

          {/* Desktop: auth or user menu */}
          <div className="hidden sm:flex items-center gap-1.5">
            {status === "anon" && (
              <>
                <Link href="/login" className="nav-link font-medium text-sm">
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
                  href="/app/welcome"
                  className="rounded-full px-4 py-2 text-sm font-semibold text-surface-950 bg-amber-500 hover:bg-amber-400 transition-colors"
                >
                  Complete profile
                </Link>
                <SignOut />
              </>
            )}
            {status === "ok" && user && <DropdownMenu user={user} />}
          </div>

          {/* Mobile burger */}
          <BurgerMenu status={status} user={user} />
        </div>
      </nav>
    </header>
  );
}
