"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FaChevronDown, FaFilm, FaTv, FaUsers } from "react-icons/fa6";
import SignOut from "../buttons/signOut";
import Avatar from "@components/ui/Avatar";
import type { AuthUser } from "@/app/contextAPI/AuthProvider";

const DropdownMenu = ({ user }: { user: AuthUser }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const displayName = user.username ?? "Account";

  const toggleDropdown = () => setIsOpen((prev) => !prev);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const linkClass =
    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-surface-300 transition-colors hover:bg-surface-700 hover:text-white";

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={toggleDropdown}
        className="flex h-10 items-center gap-2 rounded-xl border border-surface-700/50 bg-surface-800/80 py-1.5 pl-1.5 pr-3 text-sm font-medium text-surface-300 transition-all duration-150 hover:bg-surface-700 hover:text-white"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="Account menu"
      >
        <Avatar src={user.avatar_url} name={displayName} size={28} />
        <span className="hidden max-w-[100px] truncate sm:inline">{displayName}</span>
        <FaChevronDown
          className={`size-3 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-surface-700/50 bg-surface-900 py-2 shadow-xl shadow-black/30 animate-scale-in"
          role="menu"
        >
          <Link
            href={`/app/profile/${user.username ?? ""}`}
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-800"
            role="menuitem"
          >
            <Avatar src={user.avatar_url} name={displayName} size={40} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{displayName}</p>
              <p className="text-xs text-surface-500">View profile</p>
            </div>
          </Link>

          <div className="my-1 border-t border-surface-800" />

          <div className="flex flex-col gap-0.5 px-2">
            <Link
              href="/app/moviebygenre/list/16-Animation"
              onClick={() => setIsOpen(false)}
              className={linkClass}
              role="menuitem"
            >
              <FaFilm className="size-4 shrink-0 text-blue-400" />
              Movie genres
            </Link>
            <Link
              href="/app/tvbygenre/list/35-Comedy"
              onClick={() => setIsOpen(false)}
              className={linkClass}
              role="menuitem"
            >
              <FaTv className="size-4 shrink-0 text-purple-400" />
              TV genres
            </Link>
            <Link
              href="/app/profile"
              onClick={() => setIsOpen(false)}
              className={linkClass}
              role="menuitem"
            >
              <FaUsers className="size-4 shrink-0 text-amber-400" />
              Discover people
            </Link>
            <div className="my-1 border-t border-surface-800" />
            <div className="px-2">
              <SignOut />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DropdownMenu;
