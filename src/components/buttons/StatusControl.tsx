"use client";

import React, { useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import Link from "next/link";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { MdLiveTv, MdOutlineWatchLater, MdPauseCircleOutline } from "react-icons/md";
import { PiEyeBold } from "react-icons/pi";
import { RiEyeCloseLine } from "react-icons/ri";
import { IoCloseCircleOutline } from "react-icons/io5";
import { FaCheck } from "react-icons/fa";
import UserPrefrenceContext, {
  type MediaStatus,
} from "@/app/contextAPI/userPrefrence";
import { useMediaInteraction } from "@/app/contextAPI/MediaInteractionProvider";

type StatusMeta = {
  value: MediaStatus;
  label: string;
  hint: string;
  icon: React.ReactNode;
  tone: string;
};

/**
 * The five states a title can be in. This is one column in the database, so
 * it's one control here — the old UI split it across three toggle buttons
 * that silently cleared each other and left on_hold/dropped unreachable.
 */
export const STATUS_OPTIONS: StatusMeta[] = [
  {
    value: "watchlist",
    label: "Watchlist",
    hint: "Saved for later",
    icon: <MdOutlineWatchLater />,
    tone: "text-brand-400",
  },
  {
    value: "watching",
    label: "Watching",
    hint: "In progress right now",
    icon: <MdLiveTv />,
    tone: "text-accent-gold",
  },
  {
    value: "watched",
    label: "Watched",
    hint: "Finished it",
    icon: <PiEyeBold />,
    tone: "text-brand-400",
  },
  {
    value: "on_hold",
    label: "On hold",
    hint: "Paused for now",
    icon: <MdPauseCircleOutline />,
    tone: "text-surface-300",
  },
  {
    value: "dropped",
    label: "Dropped",
    hint: "Not finishing it",
    icon: <IoCloseCircleOutline />,
    tone: "text-surface-400",
  },
];

export function statusMeta(status: MediaStatus | null) {
  return STATUS_OPTIONS.find((o) => o.value === status) ?? null;
}

type StatusControlProps = {
  itemId: number | string;
  mediaType: string;
  name: string;
  imgUrl?: string;
  adult?: boolean;
  genres?: string[];
  /** "compact" for cards (icon only), "detail" for detail pages (icon + label). */
  variant?: "compact" | "detail";
  /**
   * TV only. Called with the status the user picked so the owner can open the
   * episode modal — where you are in a series is part of what the status
   * means, and "on hold" or "dropped" are meaningless without it. Passing null
   * means "just manage episodes", no status change.
   */
  onWatchedTv?: (intended: MediaStatus | null) => void;
  className?: string;
};

export default function StatusControl({
  itemId,
  mediaType,
  name,
  imgUrl,
  adult,
  genres,
  variant = "compact",
  onWatchedTv,
  className = "",
}: StatusControlProps) {
  const { getStatus, setStatus, user, loading, pendingActions, refreshPreferences } =
    useContext(UserPrefrenceContext);
  // Completing a series writes outside the preference provider, so both
  // copies of "is this watched" have to be re-pulled afterwards.
  const { refresh: refreshInteractions } = useMediaInteraction();
  const [open, setOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

  const current = getStatus(itemId);
  const meta = statusMeta(current);
  const busy = pendingActions.some((p) => p.itemId === Number(itemId));
  const disabled = loading || busy;

  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  // The menu is portalled to escape card overflow, so it has to be positioned
  // against the trigger manually.
  const openMenu = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      const menuW = 232;
      const menuH = 320;
      const left = Math.min(Math.max(8, r.left), window.innerWidth - menuW - 8);
      const below = r.bottom + 6;
      const top = below + menuH > window.innerHeight ? Math.max(8, r.top - menuH - 6) : below;
      setAnchor({ top, left });
    }
    setOpen(true);
  };

  const write = async (next: MediaStatus | null, keepData?: boolean) => {
    setOpen(false);
    setConfirmClear(false);
    const label = next ? statusMeta(next)!.label : "your list";
    const toastId = toast.loading(next ? `Moving to ${label}…` : "Removing…");
    const result = await setStatus({
      itemId,
      status: next,
      mediaType,
      name,
      imgUrl,
      adult,
      genres,
      keepData,
    });
    if (result.ok) {
      toast.success(
        next
          ? `${name} → ${label}`
          : keepData === false
            ? "Removed. Rating, diary and review deleted."
            : "Removed. Your rating, diary and review are kept.",
        { id: toastId },
      );
    } else {
      toast.error(result.message ?? "Couldn't update status", { id: toastId });
    }
  };

  /**
   * Finishing a series means every episode, so do both writes in one call.
   *
   * This used to open the episode modal instead. For a show whose episodes
   * were already all ticked the modal's diff was empty, so Save changes did
   * nothing and the show could never leave "watching". Granular episode
   * editing still lives behind "Manage episodes".
   */
  const completeSeries = async () => {
    setOpen(false);
    const toastId = toast.loading("Marking series watched…");
    try {
      const res = await fetch("/api/tv/complete-series", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ showId: itemId }),
      });
      if (!res.ok) throw new Error(String(res.status));
      await Promise.all([refreshPreferences(), refreshInteractions()]);
      toast.success(`${name} → Watched`, { id: toastId });
    } catch {
      toast.error("Couldn't mark the series watched", { id: toastId });
    }
  };

  const choose = (next: MediaStatus) => {
    if (next === current) {
      setOpen(false);
      return;
    }
    // For a series, the status and the episode progress are the same
    // statement: "watching" means up to here, "dropped" means I stopped at
    // here. So confirm the episodes, then save both together. Watchlist is the
    // exception — you haven't started, so there's nothing to record.
    if (mediaType === "tv" && onWatchedTv && next !== "watchlist") {
      setOpen(false);
      onWatchedTv(next);
      return;
    }
    if (next === "watched" && mediaType === "tv") {
      void completeSeries();
      return;
    }
    void write(next);
  };

  const requestClear = () => {
    setOpen(false);
    // Clearing a watched title can destroy a rating/review, so that one asks.
    if (current === "watched") setConfirmClear(true);
    else void write(null);
  };

  if (!user && !loading) {
    return (
      <Link
        href="/login"
        title="Log in to track this"
        className={
          variant === "detail"
            ? `inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-surface-800/60 text-surface-300 hover:text-white border border-surface-700/50 text-sm font-medium transition-colors ${className}`
            : `h-full w-full min-h-[44px] flex items-center justify-center gap-1.5 text-surface-400 hover:text-white hover:bg-white/10 transition-colors ${className}`
        }
      >
        <MdOutlineWatchLater className="size-5 shrink-0" />
        {variant === "detail" && <span>Track</span>}
      </Link>
    );
  }

  const menu = open && anchor && (
    <>
      <div className="fixed inset-0 z-[110]" onClick={() => setOpen(false)} aria-hidden />
      <div
        role="menu"
        aria-label={`Set status for ${name}`}
        style={{ top: anchor.top, left: anchor.left, width: 232 }}
        className="fixed z-[111] rounded-xl border border-surface-700 bg-surface-900 shadow-2xl overflow-hidden py-1"
      >
        {STATUS_OPTIONS.map((opt) => {
          const active = opt.value === current;
          return (
            <button
              key={opt.value}
              type="button"
              role="menuitemradio"
              aria-checked={active}
              onClick={() => choose(opt.value)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                active ? "bg-surface-800" : "hover:bg-surface-800/70"
              }`}
            >
              <span className={`text-lg shrink-0 ${active ? opt.tone : "text-surface-400"}`}>
                {opt.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-surface-100 truncate">
                  {opt.label}
                </span>
                <span className="block text-[11px] text-surface-500 truncate">{opt.hint}</span>
              </span>
              {active && <FaCheck className="size-3 text-brand-400 shrink-0" aria-hidden />}
            </button>
          );
        })}
        {onWatchedTv && (
          <>
            <div className="my-1 h-px bg-surface-700/70" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onWatchedTv(null);
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm text-surface-300 hover:bg-surface-800/70 hover:text-white transition-colors"
            >
              <MdLiveTv className="text-lg shrink-0" />
              Manage episodes
            </button>
          </>
        )}
        {current && (
          <>
            <div className="my-1 h-px bg-surface-700/70" />
            <button
              type="button"
              role="menuitem"
              onClick={requestClear}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm text-surface-400 hover:bg-surface-800/70 hover:text-white transition-colors"
            >
              <RiEyeCloseLine className="text-lg shrink-0" />
              Remove from my lists
            </button>
          </>
        )}
      </div>
    </>
  );

  const confirmDialog = confirmClear && (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      onClick={() => setConfirmClear(false)}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-surface-600 bg-surface-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-surface-700 px-4 py-3">
          <h3 className="text-lg font-semibold text-white">Remove from Watched?</h3>
        </div>
        <div className="px-4 py-4">
          <p className="text-surface-300 mb-3">
            <span className="font-medium text-white">&quot;{name}&quot;</span> will leave your
            profile and diary.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-end">
            <button
              type="button"
              onClick={() => setConfirmClear(false)}
              className="order-3 sm:order-1 px-4 py-2.5 rounded-xl border border-surface-600 bg-surface-800 text-surface-200 font-medium hover:bg-surface-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => write(null, true)}
              className="order-2 px-4 py-2.5 rounded-xl border border-accent-gold/60 bg-accent-gold/10 text-accent-gold font-medium hover:bg-accent-gold/20"
            >
              Keep rating &amp; review
            </button>
            <button
              type="button"
              onClick={() => write(null, false)}
              className="order-1 sm:order-3 px-4 py-2.5 rounded-xl bg-red-600 text-white font-medium hover:bg-red-500"
            >
              Delete everything
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {mounted && menu && createPortal(menu, document.body)}
      {mounted && confirmDialog && createPortal(confirmDialog, document.body)}
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        title={meta ? `Status: ${meta.label}` : "Add to a list"}
        className={
          variant === "detail"
            ? `inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors disabled:opacity-60 ${
                meta
                  ? "bg-brand-500/10 text-brand-300 border-brand-500/25 hover:bg-brand-500/20"
                  : "bg-surface-800/60 text-surface-300 border-surface-700/50 hover:text-white"
              } ${className}`
            : // Left-aligned with a label so every card's bar reads the same
              // way. Centring a bare icon in a wide column made untracked
              // cards look like the control had come loose.
              `h-full w-full min-h-[44px] flex items-center justify-start gap-2 px-3 transition-colors disabled:opacity-50 ${
                meta ? "text-surface-100 bg-white/5" : "text-surface-400"
              } hover:text-white hover:bg-white/10 ${className}`
        }
      >
        {busy ? (
          <AiOutlineLoading3Quarters className="animate-spin size-4 shrink-0" aria-hidden />
        ) : (
          <>
            <span className={`shrink-0 ${variant === "detail" ? "text-lg" : "text-[19px]"} ${meta?.tone ?? ""}`}>
              {meta ? meta.icon : <MdOutlineWatchLater />}
            </span>
            {variant === "detail" && <span>{meta ? meta.label : "Add to list"}</span>}
            {variant === "compact" && (
              <span className="text-[10px] font-semibold uppercase tracking-wide truncate">
                {meta ? meta.label : "Add to list"}
              </span>
            )}
          </>
        )}
      </button>
    </>
  );
}
