"use client";

import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { FaBars, FaXmark, FaUser } from "react-icons/fa6";
import { HiHome } from "react-icons/hi2";
import { FcFilmReel } from "react-icons/fc";
import { IoNotificationsOutline } from "react-icons/io5";
import { LuSend } from "react-icons/lu";
import SignOut from "../buttons/signOut";
import Link from "next/link";

interface BurgerMenuProps {
  status: "loading" | "anon" | "needs_profile" | "ok";
  username?: string | null;
}

const menuItemClass =
  "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-base font-medium text-neutral-200 transition-colors hover:bg-neutral-800 hover:text-white";

const BurgerMenu: React.FC<BurgerMenuProps> = ({ status, username }) => {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const go = (path: string) => {
    router.push(path);
    setIsOpen(false);
  };

  const triggerClass =
    "flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-700/60 bg-neutral-800 text-neutral-200 transition-colors hover:bg-neutral-700 md:hidden";

  const panelClass = `fixed inset-y-0 right-0 z-50 w-full max-w-[min(20rem,85vw)] border-l border-neutral-800 bg-neutral-900 shadow-xl transition-transform duration-300 ease-out md:hidden ${
    isOpen ? "translate-x-0" : "translate-x-full"
  }`;

  const backdropClass = `fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 md:hidden ${
    isOpen ? "opacity-100" : "pointer-events-none opacity-0"
  }`;

  if (status === "loading") return null;

  return (
    <div className="relative md:hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={triggerClass}
        aria-expanded={isOpen}
        aria-label="Open menu"
      >
        {isOpen ? <FaXmark className="size-5" /> : <FaBars className="size-5" />}
      </button>

      <div
        className={backdropClass}
        aria-hidden
        onClick={() => setIsOpen(false)}
      />

      <aside className={panelClass} aria-label="Mobile menu">
        <div className="flex h-16 items-center justify-between border-b border-neutral-800 px-4">
          <Link
            href="/app"
            onClick={() => setIsOpen(false)}
            className="text-lg font-bold text-white"
          >
            Let&apos;s see
          </Link>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-neutral-400 hover:bg-neutral-800 hover:text-white"
            aria-label="Close menu"
          >
            <FaXmark className="size-5" />
          </button>
        </div>

        <nav className="flex flex-col gap-1 p-4">
          <button type="button" onClick={() => go("/app")} className={menuItemClass}>
            <HiHome className="size-5 shrink-0" /> Home
          </button>
          <button type="button" onClick={() => go("/app/reel")} className={menuItemClass}>
            <FcFilmReel className="size-5 shrink-0" /> Reels
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
            <FaUser className="size-5 shrink-0" /> Discover people
          </button>

          {status === "anon" && (
            <>
              <div className="my-2 border-t border-neutral-800" />
              <button
                type="button"
                onClick={() => go("/login")}
                className="w-full rounded-xl bg-neutral-700 px-4 py-3 text-center font-medium text-white hover:bg-neutral-600"
              >
                Log in
              </button>
              <button
                type="button"
                onClick={() => go("/signup")}
                className="w-full rounded-xl bg-blue-600 px-4 py-3 text-center font-medium text-white hover:bg-blue-500"
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
                className="w-full rounded-xl bg-amber-600 px-4 py-3 text-center font-medium text-white hover:bg-amber-500"
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
                <IoNotificationsOutline className="size-5 shrink-0" /> Notifications
              </button>
              <button
                type="button"
                onClick={() => go("/app/messages")}
                className={menuItemClass}
              >
                <LuSend className="size-5 shrink-0" /> Messages
              </button>
              <button
                type="button"
                onClick={() => go(username ? `/app/profile/${username}` : "/app/profile")}
                className={menuItemClass}
              >
                <FaUser className="size-5 shrink-0" /> My profile
              </button>
              <div className="my-2 border-t border-neutral-800" />
              <div className="px-2">
                <SignOut />
              </div>
            </>
          )}
        </nav>
      </aside>
    </div>
  );
};

export default BurgerMenu;
