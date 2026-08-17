"use client";

import { useRouter } from "next/navigation";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { FaBars, FaXmark } from "react-icons/fa6";
import { HiHome } from "react-icons/hi2";
import { FiBell, FiMessageSquare, FiBookmark, FiHeart, FiUser, FiSearch, FiList, FiPlay, FiDownload } from "react-icons/fi";
import { FaFilm, FaTv, FaUsers } from "react-icons/fa6";
import { Film } from "lucide-react";
import SignOut from "../buttons/signOut";
import CountrySelector from "./CountrySelector";
import Link from "next/link";
import Avatar from "@components/ui/Avatar";
import type { AuthUser } from "@/app/contextAPI/AuthProvider";

interface BurgerMenuProps {
  status: "loading" | "anon" | "needs_profile" | "ok";
  user?: AuthUser | null;
}

const menuItemClass =
  "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium text-surface-300 transition-all duration-150 active:bg-surface-700 hover:bg-surface-800 hover:text-white touch-manipulation";

const BurgerMenu: React.FC<BurgerMenuProps> = ({ status, user }) => {
  const username = user?.username ?? null;
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const [unread, setUnread] = useState(0);

  // The bell and messages icons are desktop-only now, so their unread state
  // has to surface somewhere on mobile or it's invisible until you open this.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/notifications/unread-count", {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setUnread(Number(data?.total ?? 0));
      } catch {
        // A missing badge is not worth surfacing an error for.
      }
    };

    void load();
    const timer = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [user?.id]);

  const go = useCallback(
    (path: string) => {
      router.push(path);
      setIsOpen(false);
    },
    [router]
  );

  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => setMounted(typeof document !== "undefined"), []);

  useEffect(() => {
    if (!mounted) return;
    if (isOpen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [mounted, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, close]);

  useEffect(() => {
    if (!mounted) return;
    if (isOpen) closeButtonRef.current?.focus();
    else triggerRef.current?.focus({ preventScroll: true });
  }, [mounted, isOpen]);

  const triggerClass =
    "relative flex h-10 w-10 items-center justify-center rounded-xl border border-surface-700/50 bg-surface-800/80 text-surface-300 transition-all duration-150 hover:bg-surface-700 hover:text-white active:bg-surface-600 sm:hidden touch-manipulation";

  if (status === "loading") return null;

  const overlayAndPanel = (
    <>
      <div
        className="fixed inset-0 z-[100] bg-surface-950/80 backdrop-blur-sm transition-opacity duration-300 ease-out sm:hidden"
        style={{ opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? "auto" : "none" }}
        onClick={close}
      />

      <aside
        className="fixed inset-y-0 right-0 z-[110] w-full max-w-[min(20rem,88vw)] border-l border-surface-800 bg-surface-900 shadow-2xl transition-[transform] duration-300 ease-out sm:hidden"
        style={{
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          paddingRight: "env(safe-area-inset-right, 0px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
        aria-label="Mobile menu"
        aria-modal="true"
        role="dialog"
        hidden={!isOpen}
      >
        <div className="flex h-14 items-center justify-between border-b border-surface-800 px-4">
          <Link href="/app" onClick={close} className="flex items-center gap-2 text-lg font-bold text-white">
            <Film className="w-5 h-5 text-brand-500" />
            LetSee
          </Link>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={close}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-surface-400 hover:bg-surface-800 hover:text-white"
            aria-label="Close menu"
          >
            <FaXmark className="size-5" />
          </button>
        </div>

        <nav className="flex flex-col gap-0.5 overflow-y-auto p-4" style={{ maxHeight: "calc(100vh - 3.5rem)" }}>
          {/* Profile header (logged in) */}
          {status === "ok" && username && (
            <Link href={`/app/profile/${username}`} onClick={close}
              className="mb-2 flex items-center gap-3 rounded-xl bg-surface-800/60 px-3 py-3">
              <Avatar src={user?.avatar_url} name={username} size={40} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{username}</p>
                <p className="text-xs text-surface-500">View profile</p>
              </div>
            </Link>
          )}

          {/* Country */}
          <div className="px-2 py-1 mb-1">
            <CountrySelector />
          </div>

          {/* Navigation */}
          <button type="button" onClick={() => go("/app")} className={menuItemClass}>
            <HiHome className="size-5 shrink-0" /> Home
          </button>
          {/* Top of the list on mobile, because the phone is what's in your
              hand when the question "what do we put on" actually comes up. */}
          {status === "ok" && (
            <button type="button" onClick={() => go("/app/tonight")} className={menuItemClass}>
              <FiPlay className="size-5 shrink-0 text-brand-400" /> Tonight
            </button>
          )}
          <button type="button" onClick={() => go("/app/search")} className={menuItemClass}>
            <FiSearch className="size-5 shrink-0" /> Search
          </button>

          {/* Browsing, open to everyone. These were gated behind a signed-in
              check, so a visitor's whole menu was Home / Search and then a
              login wall — nothing to look at before deciding to join. All of
              these render fine signed out. */}
          <div className="my-1 border-t border-surface-800" />
          <button type="button" onClick={() => go("/app/profile")} className={menuItemClass}>
            <FaUsers className="size-5 shrink-0 text-amber-400" /> Discover people
          </button>
          <button type="button" onClick={() => go("/app/clubs")} className={menuItemClass}>
            <FaUsers className="size-5 shrink-0 text-brand-400" /> Clubs
          </button>
          <button type="button" onClick={() => go("/app/lists")} className={menuItemClass}>
            <FiList className="size-5 shrink-0 text-sky-400" /> Lists
          </button>
          <button type="button" onClick={() => go("/app/browse")} className={menuItemClass}>
            <FaFilm className="size-5 shrink-0 text-blue-400" /> Browse films
          </button>
          <button type="button" onClick={() => go("/app/browse?type=tv")} className={menuItemClass}>
            <FaTv className="size-5 shrink-0 text-purple-400" /> Browse shows
          </button>

          {/* Yours — only meaningful once there's an account behind them. */}
          {status === "ok" && (
            <>
              <div className="my-1 border-t border-surface-800" />
              <button type="button" onClick={() => go("/app/watchlist")} className={menuItemClass}>
                <FiBookmark className="size-5 shrink-0 text-amber-400" /> Watchlist
              </button>
              <button type="button" onClick={() => go(username ? `/app/profile/${username}` : "/app/profile")} className={menuItemClass}>
                <FiHeart className="size-5 shrink-0 text-rose-400" /> Favorites
              </button>
              <button type="button" onClick={() => go("/app/import")} className={menuItemClass}>
                <FiDownload className="size-5 shrink-0 text-emerald-400" /> Import from Letterboxd
              </button>
              <button type="button" onClick={() => go("/app/notification")} className={menuItemClass}>
                <FiBell className="size-5 shrink-0 text-blue-400" /> Notifications
              </button>
              <button type="button" onClick={() => go("/app/messages")} className={menuItemClass}>
                <FiMessageSquare className="size-5 shrink-0 text-green-400" /> Messages
              </button>
            </>
          )}

          {/* Auth */}
          <div className="my-2 border-t border-surface-800" />

          {status === "anon" && (
            <>
              <button type="button" onClick={() => go("/login")}
                className="w-full rounded-xl bg-surface-800 border border-surface-700 px-4 py-3 text-center font-medium text-surface-200 hover:bg-surface-700 transition-colors">
                Log in
              </button>
              <button type="button" onClick={() => go("/signup")}
                className="w-full rounded-xl bg-brand-500 px-4 py-3 text-center font-medium text-surface-950 hover:bg-brand-600 transition-colors mt-2">
                Sign up
              </button>
            </>
          )}

          {status === "needs_profile" && (
            <>
              <button type="button" onClick={() => go("/app/welcome")}
                className="w-full rounded-xl bg-amber-500 px-4 py-3 text-center font-medium text-surface-950 hover:bg-amber-400 transition-colors">
                Complete profile
              </button>
              <div className="mt-3">
                <SignOut />
              </div>
            </>
          )}

          {status === "ok" && (
            <div className="px-2">
              <SignOut />
            </div>
          )}
        </nav>
      </aside>
    </>
  );

  return (
    <div className="relative sm:hidden">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={triggerClass}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={isOpen ? "Close menu" : "Open menu"}
      >
        {isOpen ? <FaXmark className="size-5" /> : <FaBars className="size-5" />}
        {!isOpen && unread > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1"
            aria-hidden
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {mounted && createPortal(overlayAndPanel, document.body)}
    </div>
  );
};

export default BurgerMenu;
