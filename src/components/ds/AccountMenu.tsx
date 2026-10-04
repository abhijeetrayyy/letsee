"use client";

import { useEffect, useRef, useState } from "react";
import { Database, Link2, ListVideo, Moon, Pencil, Settings, Sun, Upload } from "lucide-react";
import { currentTheme, setTheme, type Theme } from "@/lib/theme";
import Link from "@components/ui/AppLink";
import Avatar from "@components/ui/Avatar";
import Sheet from "@components/ds/Sheet";
import SignOut from "@components/buttons/signOut";
import CountrySelector from "@components/header/CountrySelector";
import type { AuthUser } from "@/app/contextAPI/AuthProvider";

/**
 * The few things that are about your account rather than about people or
 * films: editing your profile, lists, bringing your history in or taking it
 * out, your country, signing out (docs/design/PAGES.md §0 "Avatar menu, burger
 * … gone; everything has a destination").
 *
 * On a desktop it opens from your face in the bar. On a phone it opens from
 * the settings button on your own profile, where people expect it.
 */
/** Light or dark, for the whole app; remembered on this device. Also in settings. */
export function ThemeSwitch({ className = "mb-2 px-3" }: { className?: string } = {}) {
  const [theme, set] = useState<Theme>("light");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the theme lives on <html>, which only the browser can read
    set(currentTheme());
  }, []);
  const pick = (t: Theme) => {
    setTheme(t);
    set(t);
  };
  // Sized by their words, not a fixed width: at w-44 beside its label the
  // switch was wider than the account menu and pushed out of it.
  const seg = (on: boolean) =>
    `inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors ${on ? "bg-inverse text-ink-900" : "text-ink-400 hover:text-ink-0"}`;
  return (
    <div className={`flex min-w-0 items-center justify-between gap-3 ${className}`}>
      <span className="min-w-0 text-sm text-ink-500">Appearance</span>
      <div role="group" aria-label="Appearance" className="flex shrink-0 gap-1 rounded-full p-1 ring-1 ring-inset ring-line-strong">
        <button type="button" aria-pressed={theme === "light"} onClick={() => pick("light")} className={seg(theme === "light")}>
          <Sun className="size-4" aria-hidden /> Light
        </button>
        <button type="button" aria-pressed={theme === "dark"} onClick={() => pick("dark")} className={seg(theme === "dark")}>
          <Moon className="size-4" aria-hidden /> Dark
        </button>
      </div>
    </div>
  );
}

/**
 * The menu's contents, in three groups with room between them: you and your
 * places (profile, edit, lists, links, history, data), two settings as
 * label-and-control rows, then signing out. Everything sizes to the menu —
 * the old version had a fixed-width switch and a full-width button that
 * stuck out past its edges.
 */
function AccountLinks({ user, onPick }: { user: AuthUser | null; onPick: () => void }) {
  const row = "flex h-10 w-full min-w-0 items-center gap-3 rounded-control px-3 text-sm font-medium text-ink-200 transition-colors hover:bg-hover hover:text-ink-0";
  const icon = "size-4 shrink-0 text-ink-500";
  const name = user?.username ?? null;
  return (
    <div className="flex min-w-0 flex-col">
      {name && (
        <Link href={`/app/profile/${name}`} onClick={onPick} className="flex min-w-0 items-center gap-3 rounded-control px-3 py-2.5 transition-colors hover:bg-hover">
          <Avatar src={user?.avatar_url} name={name} size={36} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-ink-0">{name}</span>
            <span className="block text-xs text-ink-500">See your profile</span>
          </span>
        </Link>
      )}
      <div className="my-1.5 border-t border-line" />
      <nav aria-label="Your account" className="flex flex-col">
        {name ? (
          <>
            <Link href="/app/settings" onClick={onPick} className={row}>
              <Pencil className={icon} aria-hidden />
              Edit profile
            </Link>
            <Link href="/app/lists" onClick={onPick} className={row}>
              <ListVideo className={icon} aria-hidden />
              Lists
            </Link>
            <Link href="/app/links" onClick={onPick} className={row}>
              <Link2 className={icon} aria-hidden />
              Links you&apos;ve sent
            </Link>
            <Link href="/app/import" onClick={onPick} className={row}>
              <Upload className={icon} aria-hidden />
              Bring your history in
            </Link>
            <Link href="/app/settings#your-data" onClick={onPick} className={row}>
              <Database className={icon} aria-hidden />
              Your data
            </Link>
          </>
        ) : (
          <Link href="/app/welcome" onClick={onPick} className={row}>
            <Pencil className={icon} aria-hidden />
            Finish your profile
          </Link>
        )}
      </nav>
      <div className="my-1.5 border-t border-line" />
      <div className="flex flex-col gap-2 px-3 py-1.5">
        <ThemeSwitch className="" />
        <div className="flex min-w-0 items-center justify-between gap-3">
          <span className="min-w-0 text-sm text-ink-500">Where you watch</span>
          <CountrySelector />
        </div>
      </div>
      <div className="my-1.5 border-t border-line" />
      <SignOut />
      {/* The footer's credits, which left app pages with the footer. */}
      <p className="mt-2 px-3 pb-1 text-xs leading-relaxed text-ink-600">
        Film and TV data from{" "}
        <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer" className="underline decoration-line-input underline-offset-2 hover:text-ink-300">
          TMDB
        </a>
        ; not endorsed or certified by TMDB. Made by{" "}
        <a href="https://github.com/abhijeetrayyy" target="_blank" rel="noreferrer" className="underline decoration-line-input underline-offset-2 hover:text-ink-300">
          Abhijeet Ray
        </a>
        .
      </p>
    </div>
  );
}

/** Desktop: your face in the bar opens this. */
export function AccountMenu({ user }: { user: AuthUser | null }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const name = user?.username ?? "Account";

  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Your account"
        className="flex size-10 items-center justify-center rounded-full transition-colors hover:bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <Avatar src={user?.avatar_url} name={name} size={30} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-card border border-line-strong bg-overlay p-2 shadow-2xl">
          <AccountLinks user={user} onPick={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

/** Phones: the settings button on your own profile opens this. */
export function AccountSheetButton({ user }: { user: AuthUser | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Settings"
        className="flex size-10 items-center justify-center rounded-full text-ink-300 transition-colors hover:bg-hover hover:text-ink-0"
      >
        <Settings className="size-5" aria-hidden />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Settings">
        <AccountLinks user={user} onPick={() => setOpen(false)} />
      </Sheet>
    </>
  );
}
