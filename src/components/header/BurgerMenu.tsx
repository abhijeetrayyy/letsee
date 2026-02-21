"use client";

import { useRouter } from "next/navigation";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { FaBars, FaXmark, FaUser, FaMagnifyingGlass } from "react-icons/fa6";
import { HiHome } from "react-icons/hi2";
import { FcFilmReel } from "react-icons/fc";
import { IoNotificationsOutline } from "react-icons/io5";
import { LuSend } from "react-icons/lu";
import SignOut from "../buttons/signOut";
import CountrySelector from "./CountrySelector";
import Link from "next/link";

interface BurgerMenuProps {
  status: "loading" | "anon" | "needs_profile" | "ok";
  username?: string | null;
}

const menuItemClass =
  "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-base font-medium text-neutral-200 transition-colors active:bg-neutral-700 hover:bg-neutral-800 hover:text-white touch-manipulation";

const BurgerMenu: React.FC<BurgerMenuProps> = ({ status, username }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  const go = useCallback(
    (path: string) => {
      router.push(path);
      setIsOpen(false);
    },
    [router]
  );

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  // Portal target: overlay + panel live at body root so they always cover viewport and sit above header
  useEffect(() => setMounted(typeof document !== "undefined"), []);

  // Scroll lock when menu is open (mobile)
  useEffect(() => {
    if (!mounted) return;
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [mounted, isOpen]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, close]);

  // Focus: when opening focus close button; when closing focus trigger
  useEffect(() => {
    if (!mounted) return;
    if (isOpen) {
      closeButtonRef.current?.focus();
    } else {
      triggerRef.current?.focus({ preventScroll: true });
    }
  }, [mounted, isOpen]);

  const triggerClass =
    "flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-700/60 bg-neutral-800 text-neutral-200 transition-colors hover:bg-neutral-700 active:bg-neutral-600 md:hidden touch-manipulation";

  if (status === "loading") return null;

  const overlayAndPanel = (
    <>
      {/* Backdrop: full viewport, below panel, blocks interaction with page */}
      <div
        className="fixed inset-0 z-[100] bg-black/80 transition-opacity duration-300 ease-out md:hidden"
        style={{
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
        }}
        aria-hidden
        onClick={close}
      />

      {/* Panel: full height from top, slides in from right */}
      <aside
        className="fixed inset-y-0 right-0 z-[110] w-full max-w-[min(20rem,88vw)] border-l border-neutral-800 bg-neutral-900 shadow-2xl transition-[transform] duration-300 ease-out md:hidden"
        style={{
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          paddingRight: "env(safe-area-inset-right, 0px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
        id="mobile-menu-panel"
        aria-label="Mobile menu"
        aria-modal="true"
        role="dialog"
        hidden={!isOpen}
      >
        <div className="flex h-14 min-h-14 items-center justify-between border-b border-neutral-800 px-4 pr-[max(1rem,env(safe-area-inset-right))]">
          <Link
            href="/app"
            onClick={close}
            className="text-lg font-bold text-white"
          >
            Let&apos;s see
          </Link>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={close}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-neutral-400 hover:bg-neutral-800 hover:text-white active:bg-neutral-700 touch-manipulation"
            aria-label="Close menu"
          >
            <FaXmark className="size-5" />
          </button>
        </div>

        <nav className="flex flex-col gap-0.5 overflow-y-auto p-4" style={{ maxHeight: "calc(100vh - 3.5rem)" }}>
          <div className="px-4 py-2 sm:hidden">
            <CountrySelector />
          </div>
          <button type="button" onClick={() => go("/app")} className={menuItemClass}>
            <HiHome className="size-5 shrink-0" aria-hidden /> Home
          </button>
          <button type="button" onClick={() => go("/app/search")} className={menuItemClass}>
            <FaMagnifyingGlass className="size-5 shrink-0" aria-hidden /> Search
          </button>
          <button type="button" onClick={() => go("/app/reel")} className={menuItemClass}>
            <FcFilmReel className="size-5 shrink-0" aria-hidden /> Reels
          </button>
          <button
            type="button"
            onClick={() => go("/app/tvbygenre/list/35-Comedy")}
            className={menuItemClass}
          >
            TV genres
          </button>
          <button
            type="button"
            onClick={() => go("/app/moviebygenre/list/16-Animation")}
            className={menuItemClass}
          >
            Movie genres
          </button>
          <button type="button" onClick={() => go("/app/profile")} className={menuItemClass}>
            <FaUser className="size-5 shrink-0" aria-hidden /> Discover people
          </button>

          {status === "anon" && (
            <>
              <div className="my-2 border-t border-neutral-800" />
              <button
                type="button"
                onClick={() => go("/login")}
                className="w-full rounded-xl bg-neutral-700 px-4 py-3 text-center font-medium text-white hover:bg-neutral-600 active:bg-neutral-600 touch-manipulation"
              >
                Log in
              </button>
              <button
                type="button"
                onClick={() => go("/signup")}
                className="w-full rounded-xl bg-blue-600 px-4 py-3 text-center font-medium text-white hover:bg-blue-500 active:bg-blue-500 touch-manipulation"
              >
                Sign up
              </button>
            </>
          )}

          {status === "needs_profile" && (
            <>
              <div className="my-2 border-t border-neutral-800" />
              <button
                type="button"
                onClick={() => go("/app/profile/setup")}
                className="w-full rounded-xl bg-amber-600 px-4 py-3 text-center font-medium text-white hover:bg-amber-500 active:bg-amber-500 touch-manipulation"
              >
                Complete profile
              </button>
              <div className="mt-2">
                <SignOut />
              </div>
            </>
          )}

          {status === "ok" && (
            <>
              <button
                type="button"
                onClick={() => go("/app/notification")}
                className={menuItemClass}
              >
                <IoNotificationsOutline className="size-5 shrink-0" aria-hidden /> Notifications
              </button>
              <button
                type="button"
                onClick={() => go("/app/messages")}
                className={menuItemClass}
              >
                <LuSend className="size-5 shrink-0" aria-hidden /> Messages
              </button>
              <button
                type="button"
                onClick={() => go(username ? `/app/profile/${username}` : "/app/profile")}
                className={menuItemClass}
              >
                <FaUser className="size-5 shrink-0" aria-hidden /> My profile
              </button>
              <div className="my-2 border-t border-neutral-800" />
              <div className="px-2">
                <SignOut />
              </div>
            </>
          )}
        </nav>
      </aside>
    </>
  );

  return (
    <div className="relative md:hidden">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={triggerClass}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-controls="mobile-menu-panel"
        aria-label={isOpen ? "Close menu" : "Open menu"}
      >
        {isOpen ? <FaXmark className="size-5" aria-hidden /> : <FaBars className="size-5" aria-hidden />}
      </button>

      {mounted && createPortal(overlayAndPanel, document.body)}
    </div>
  );
};

export default BurgerMenu;
