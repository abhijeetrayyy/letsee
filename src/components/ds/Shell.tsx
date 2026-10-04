"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { House, ListVideo, Plus, Search, Users } from "lucide-react";
import Link from "@components/ui/AppLink";
import Avatar from "@components/ui/Avatar";
import Mark from "@components/ds/Mark";
import { AccountMenu, AccountSheetButton } from "@components/ds/AccountMenu";
import LogItSheet from "@components/ds/LogItSheet";
import QuickSearch, { openQuickSearch } from "@components/search/QuickSearch";
import { useAuth, type AuthUser } from "@/app/contextAPI/AuthProvider";
import { useUnreadCounts } from "@/hooks/useUnreadCounts";
import { activeTab, hidesTabBar, tabs, type TabKey } from "@components/ds/tabs";
import { useClaimPendingPass } from "@components/doors/useClaimPendingPass";

/**
 * The shell under `ui=v2` (docs/design/PAGES.md §0, SYSTEM.md §8 Shell).
 *
 * Five places, labelled, on every page: a tab bar on phones and text links in
 * the desktop bar. Log it is an action, not a place, so it is a button and not
 * a tab. There are no counts anywhere — People carries one white dot when
 * something in a room is new, because a number turns people into a backlog.
 */
export function ShellBars() {
  const { status, user } = useAuth();
  useClaimPendingPass(status === "ok");
  const pathname = usePathname() ?? "/";
  const signedIn = status === "ok" && !!user;
  const username = user?.username ?? null;
  const current = activeTab(pathname, username);
  const somethingNew = useSomethingNew(signedIn ? user?.id : null);

  return (
    <>
      {/* First Tab stop on every page: past the bars to the page itself (the root layout's <main id="content">). */}
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-60 focus:rounded-full focus:bg-overlay focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:text-ink-0 focus:shadow-lg focus:ring-1 focus:ring-line-strong"
      >
        Skip to content
      </a>
      <QuickSearch />
      <PhoneTopBar status={status} user={user} current={current} />
      <DesktopBar status={status} user={user} current={current} somethingNew={somethingNew} />
      {signedIn && !hidesTabBar(pathname) && <TabBar username={username} avatar={user?.avatar_url ?? null} current={current} somethingNew={somethingNew} />}
    </>
  );
}

function useSomethingNew(userId: string | null | undefined): boolean {
  const { total } = useUnreadCounts(userId);
  return total > 0;
}

function TabBar({
  username,
  avatar,
  current,
  somethingNew,
}: {
  username: string | null;
  avatar: string | null;
  current: TabKey | null;
  somethingNew: boolean;
}) {
  return (
    <nav aria-label="Main" className="tab-bar bar-glass fixed inset-x-0 bottom-0 z-40 border-t border-line md:hidden">
      <ul className="mx-auto grid h-14 max-w-sheet grid-cols-5">
        {tabs(username).map((tab) => {
          const on = current === tab.key;
          return (
            <li key={tab.key}>
              <Link
                href={tab.href}
                // Search opens over the page you're on; on the Search page
                // itself the tab is just where you are.
                onClick={(e) => {
                  if (tab.key === "search" && !on) {
                    e.preventDefault();
                    openQuickSearch();
                  }
                }}
                aria-current={on ? "page" : undefined}
                aria-label={tab.key === "people" && somethingNew ? "People, something new" : undefined}
                className={`flex h-full flex-col items-center justify-center gap-1 text-xs font-medium transition-colors ${
                  on ? "text-ink-0" : "text-ink-500 active:text-ink-0"
                }`}
              >
                <TabIcon tab={tab.key} on={on} avatar={avatar} name={username} somethingNew={somethingNew} />
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function TabIcon({
  tab,
  on,
  avatar,
  name,
  somethingNew,
}: {
  tab: TabKey;
  on: boolean;
  avatar: string | null;
  name: string | null;
  somethingNew: boolean;
}) {
  const stroke = on ? 2.25 : 1.75;
  const icon = "size-5.5";
  switch (tab) {
    case "home":
      return <House className={icon} strokeWidth={stroke} aria-hidden />;
    case "search":
      return <Search className={icon} strokeWidth={stroke} aria-hidden />;
    case "up-next":
      return <ListVideo className={icon} strokeWidth={stroke} aria-hidden />;
    case "people":
      return (
        <span className="relative">
          <Users className={icon} strokeWidth={stroke} aria-hidden />
          {somethingNew && <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-ink-0 ring-2 ring-page" aria-hidden />}
        </span>
      );
    case "you":
      return (
        <span className={`rounded-full ${on ? "ring-2 ring-ink-0 ring-offset-2 ring-offset-page" : ""}`}>
          <Avatar src={avatar} name={name ?? "You"} size={22} />
        </span>
      );
  }
}

/** Log it from the bar: the search-first sheet (PAGES.md §7). Bulk catch-up is a link inside it. */
function LogButton({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  // Stable: Sheet's effect depends on onClose, and re-running it moves focus
  // to the panel — out of the search field — whenever the bars re-render.
  const close = useCallback(() => setOpen(false), []);
  const pathname = usePathname();
  // A title opened from the sheet is a new page; the sheet shouldn't follow.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- closing on navigation is the point
  useEffect(() => setOpen(false), [pathname]);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full bg-action font-semibold text-on-action transition-colors hover:bg-action-hover ${
          compact ? "h-9 px-3.5 text-sm" : "h-9 px-4 text-sm"
        }`}
      >
        <Plus className="size-4" aria-hidden />
        {compact ? "Log" : "Log it"}
      </button>
      <LogItSheet open={open} onClose={close} />
    </>
  );
}

function PhoneTopBar({ status, user, current }: { status: string; user: AuthUser | null; current: TabKey | null }) {
  const pathname = usePathname() ?? "/";
  const ownProfile = current === "you" && /^\/app\/profile\/[^/]+$/.test(pathname.replace(/\/+$/, ""));

  let action: React.ReactNode = null;
  if (status === "anon") {
    action = (
      <div className="flex items-center gap-1">
        <button type="button" onClick={openQuickSearch} aria-label="Search" aria-haspopup="dialog" className="flex size-10 items-center justify-center rounded-full text-ink-300 hover:bg-hover hover:text-ink-0">
          <Search className="size-5" aria-hidden />
        </button>
        <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="inline-flex h-9 items-center rounded-full bg-action px-4 text-sm font-semibold text-on-action hover:bg-action-hover">
          Sign in
        </Link>
      </div>
    );
  } else if (status === "needs_profile") {
    action = (
      <div className="flex items-center gap-1">
        <Link href="/app/welcome" className="inline-flex h-9 items-center rounded-full bg-action px-4 text-sm font-semibold text-on-action hover:bg-action-hover">
          Finish your profile
        </Link>
        <AccountSheetButton user={user} />
      </div>
    );
  } else if (status === "ok") {
    if (current === "home" || current === "up-next") action = <LogButton compact />;
    else if (ownProfile) action = <AccountSheetButton user={user} />;
  }

  return (
    <header className="bar-glass sticky top-0 z-40 border-b border-line md:hidden">
      <div className="flex h-14 items-center justify-between gap-3 px-4">
        <Link href="/app" aria-label="letsee, home">
          <Mark />
        </Link>
        {action}
      </div>
    </header>
  );
}

function DesktopBar({
  status,
  user,
  current,
  somethingNew,
}: {
  status: string;
  user: AuthUser | null;
  current: TabKey | null;
  somethingNew: boolean;
}) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const signedIn = status === "ok" && !!user;

  // "/" opens search from anywhere, over the page, unless you are already typing somewhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      e.preventDefault();
      openQuickSearch();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const link = (on: boolean) =>
    `relative inline-flex h-14 items-center text-sm font-medium transition-colors ${on ? "text-ink-0" : "text-ink-500 hover:text-ink-0"}`;

  return (
    <header className="sticky top-0 z-50 hidden border-b border-line bg-page md:block">
      <div className="mx-auto flex h-14 max-w-app items-center gap-8 px-6">
        <Link href="/app" aria-label="letsee, home" className="shrink-0">
          <Mark />
        </Link>

        {signedIn && (
          <nav aria-label="Main">
            <ul className="flex items-center gap-6">
              {tabs(user?.username ?? null).map((tab) => {
                const on = current === tab.key;
                return (
                  <li key={tab.key}>
                    <Link href={tab.href} aria-current={on ? "page" : undefined} className={link(on)}>
                      {tab.label}
                      {tab.key === "people" && somethingNew && (
                        <>
                          <span className="ml-1.5 size-1.5 rounded-full bg-ink-0" aria-hidden />
                          <span className="sr-only">, something new</span>
                        </>
                      )}
                      {on && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-ink-0" aria-hidden />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}

        <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-3">
          {current !== "search" && (
            <button
              type="button"
              onClick={openQuickSearch}
              aria-haspopup="dialog"
              className="flex h-9 w-64 items-center gap-2 rounded-full bg-raised px-3.5 text-left text-sm text-ink-500 ring-1 ring-inset ring-line-input transition-colors hover:text-ink-300 lg:w-80"
            >
              <Search className="size-4" aria-hidden />
              <span className="flex-1">Films, series, anime, people</span>
              <kbd className="font-mono text-xs text-ink-600">/</kbd>
            </button>
          )}
          {status === "anon" && (
            <>
              <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="shrink-0 text-sm font-medium text-ink-300 hover:text-ink-0">
                Log in
              </Link>
              <Link href="/signup" className="inline-flex h-9 shrink-0 items-center rounded-full bg-action px-4 text-sm font-semibold text-on-action hover:bg-action-hover">
                Sign up
              </Link>
            </>
          )}
          {status === "needs_profile" && (
            <>
              <Link href="/app/welcome" className="inline-flex h-9 shrink-0 items-center rounded-full bg-action px-4 text-sm font-semibold text-on-action hover:bg-action-hover">
                Finish your profile
              </Link>
              <AccountMenu user={user} />
            </>
          )}
          {signedIn && (
            <>
              <LogButton />
              <AccountMenu user={user} />
            </>
          )}
        </div>
      </div>
    </header>
  );
}
