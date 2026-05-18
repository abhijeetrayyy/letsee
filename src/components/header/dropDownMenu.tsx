"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FaChevronDown, FaUser, FaFilm, FaTv, FaUsers } from "react-icons/fa6";
import SignOut from "../buttons/signOut";

const DropdownMenu = ({ user }: { user: { username?: string } }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
        className="flex h-10 items-center gap-2 rounded-xl border border-surface-700/50 bg-surface-800/80 px-3 py-2 text-sm font-medium text-surface-300 transition-all duration-150 hover:bg-surface-700 hover:text-white"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="Account menu"
      >
        <FaUser className="size-4 shrink-0" />
        <span className="hidden max-w-[100px] truncate sm:inline">
          {user?.username ?? "Account"}
        </span>
        <FaChevronDown
          className={`size-3 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-surface-700/50 bg-surface-900 py-2 shadow-xl shadow-black/30 animate-scale-in"
          role="menu"
        >
          <div className="flex flex-col gap-0.5 px-2">
            <Link
              href={`/app/profile/${user?.username ?? ""}`}
              onClick={() => setIsOpen(false)}
              className={linkClass}
              role="menuitem"
            >
              <FaUser className="size-4 shrink-0 text-brand-400" />
              My profile
            </Link>
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
