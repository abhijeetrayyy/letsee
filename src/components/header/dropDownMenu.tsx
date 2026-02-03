"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FaChevronDown, FaUser } from "react-icons/fa6";
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
    "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-700 hover:text-white";

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={toggleDropdown}
        className="flex h-10 items-center gap-2 rounded-xl border border-neutral-700/60 bg-neutral-800 px-3 py-2 text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-700"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="Account menu"
      >
        <FaUser className="size-4 shrink-0" />
        <span className="hidden max-w-[100px] truncate sm:inline">
          {user?.username ?? "Account"}
        </span>
        <FaChevronDown
          className={`size-3.5 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-neutral-700 bg-neutral-800 py-2 shadow-xl"
          role="menu"
        >
          <div className="flex flex-col gap-0.5 px-2">
            <Link
              href={`/app/profile/${user?.username ?? ""}`}
              onClick={() => setIsOpen(false)}
              className={linkClass}
              role="menuitem"
            >
              <FaUser className="size-4 shrink-0" />
              My profile
            </Link>
            <Link
              href="/app/moviebygenre/list/16-Animation"
              onClick={() => setIsOpen(false)}
              className={linkClass}
              role="menuitem"
            >
              Movie genres
            </Link>
            <Link
              href="/app/tvbygenre/list/35-Comedy"
              onClick={() => setIsOpen(false)}
              className={linkClass}
              role="menuitem"
            >
              TV genres
            </Link>
            <div className="my-1 border-t border-neutral-700" />
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
