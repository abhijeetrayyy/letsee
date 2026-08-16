"use client";

import { useMediaInteraction } from "@/app/contextAPI/MediaInteractionProvider";
import { CiHeart } from "react-icons/ci";
import { FcLike } from "react-icons/fc";
import { MdOutlineWatchLater, MdLiveTv } from "react-icons/md";
import { PiEyeBold } from "react-icons/pi";
import { RiEyeCloseLine } from "react-icons/ri";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { useState, useCallback } from "react";
import toast from "react-hot-toast";

export interface MediaActionsProps {
  itemId: number | string;
  itemType: string;
  itemName: string;
  itemImg?: string | null;
  itemAdult?: boolean;
  genres?: string[];
  /** "compact" = icon grid for cards, "detail" = pill buttons for detail pages */
  variant?: "compact" | "detail";
}

type StatusOption = {
  value: "watchlist" | "watching" | "watched" | "on_hold" | "dropped" | null;
  label: string;
  icon: React.ReactNode;
  iconActive: React.ReactNode;
};

const STATUS_OPTIONS: StatusOption[] = [
  {
    value: "watchlist",
    label: "Want to Watch",
    icon: <MdOutlineWatchLater className="size-5 text-surface-400" />,
    iconActive: <MdOutlineWatchLater className="size-5 text-emerald-400 font-bold" />,
  },
  {
    value: "watching",
    label: "Watching",
    icon: <MdLiveTv className="size-5 text-surface-400" />,
    iconActive: <MdLiveTv className="size-5 text-amber-400" />,
  },
  {
    value: "watched",
    label: "Watched",
    icon: <RiEyeCloseLine className="size-5 text-surface-400" />,
    iconActive: <PiEyeBold className="size-5 text-emerald-400" />,
  },
  {
    value: "on_hold",
    label: "On Hold",
    icon: <MdOutlineWatchLater className="size-5 text-surface-400" />,
    iconActive: <MdOutlineWatchLater className="size-5 text-yellow-400" />,
  },
  {
    value: "dropped",
    label: "Dropped",
    icon: <RiEyeCloseLine className="size-5 text-surface-400" />,
    iconActive: <RiEyeCloseLine className="size-5 text-red-400" />,
  },
];

export default function MediaActions({
  itemId,
  itemType,
  itemName,
  itemImg,
  itemAdult,
  genres = [],
  variant = "compact",
}: MediaActionsProps) {
  const {
    getStatus,
    isFavorited,
    isPending,
    isAuthenticated,
    setStatus,
    toggleFavorite,
  } = useMediaInteraction();

  const id = String(itemId);
  const status = getStatus(id, itemType);
  const favorited = isFavorited(id, itemType);
  const pending = isPending(id);
  const meta = { itemType, name: itemName, imgUrl: itemImg ?? "", adult: itemAdult ?? false, genres };

  const currentOption = STATUS_OPTIONS.find((o) => o.value === status) ?? null;

  const handleStatusChange = useCallback(
    async (newStatus: StatusOption["value"]) => {
      if (!isAuthenticated) {
        toast.error("Log in to save preferences.");
        return;
      }
      if (pending) return;

      const ok = await setStatus(id, newStatus, meta);
      if (ok) {
        toast.success(
          newStatus
            ? `${itemName} → ${STATUS_OPTIONS.find((o) => o.value === newStatus)?.label}`
            : `Removed ${itemName}`
        );
      } else {
        toast.error("Failed to update status");
      }
    },
    [id, isAuthenticated, pending, setStatus, meta, itemName]
  );

  const handleFavorite = useCallback(async () => {
    if (!isAuthenticated) {
      toast.error("Log in to save favorites.");
      return;
    }
    if (pending) return;

    const ok = await toggleFavorite(id, meta);
    if (ok) {
      toast.success(favorited ? "Removed from favorites" : "Added to favorites");
    } else {
      toast.error("Failed to update favorite");
    }
  }, [id, isAuthenticated, pending, toggleFavorite, favorited, meta]);

  if (variant === "detail") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {/* Status pills */}
        {STATUS_OPTIONS.map((opt) => {
          const isActive = status === opt.value;
          return (
            <button
              key={opt.value ?? "none"}
              type="button"
              onClick={() => handleStatusChange(isActive ? null : opt.value)}
              disabled={pending}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 active:scale-[0.98] disabled:opacity-50 touch-manipulation ${
                isActive
                  ? "bg-brand-500/20 text-brand-400 border border-brand-500/40"
                  : "bg-surface-700/80 text-surface-300 border border-surface-600 hover:bg-surface-600 hover:border-surface-500"
              }`}
              aria-label={opt.label}
              aria-pressed={isActive}
            >
              {pending && status === opt.value ? (
                <AiOutlineLoading3Quarters className="shrink-0 size-4 animate-spin" />
              ) : isActive ? (
                opt.iconActive
              ) : (
                opt.icon
              )}
              {opt.label}
            </button>
          );
        })}

        {/* Favorite button */}
        <button
          type="button"
          onClick={handleFavorite}
          disabled={pending}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 active:scale-[0.98] disabled:opacity-50 touch-manipulation ${
            favorited
              ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
              : "bg-surface-700/80 text-surface-300 border border-surface-600 hover:bg-surface-600 hover:border-surface-500"
          }`}
          aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
          aria-pressed={favorited}
        >
          {favorited ? <FcLike className="shrink-0 size-4" /> : <CiHeart className="shrink-0 size-4" />}
          {favorited ? "Favorited" : "Favorite"}
        </button>
      </div>
    );
  }

  // Compact variant: 3 icons in a row (status, favorite, more)
  return (
    <div className="w-full">
      <div className="w-full h-12 grid grid-cols-3 gap-px bg-white/5">
        {/* Status toggle */}
        <ActionButton
          icon={currentOption?.iconActive ?? <RiEyeCloseLine className="size-5 text-surface-400" />}
          active={!!status}
          pending={pending}
          onClick={() => {
            // Cycle: none → watchlist → watching → watched → none
            if (!status) handleStatusChange("watchlist");
            else if (status === "watchlist") handleStatusChange("watching");
            else if (status === "watching") handleStatusChange("watched");
            else handleStatusChange(null);
          }}
          title={status ? currentOption?.label ?? status : "Add status"}
        />

        {/* Favorite */}
        <ActionButton
          icon={favorited ? <FcLike className="size-5" /> : <CiHeart className="size-5 text-surface-400" />}
          active={favorited}
          pending={pending}
          onClick={handleFavorite}
          title={favorited ? "Remove from favorites" : "Add to favorites"}
        />

        {/* Rating - simple star indicator, detailed rating comes from rating component */}
        <ActionButton
          icon={
            <svg className="size-5 text-surface-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          }
          active={false}
          pending={false}
          onClick={() => {}} // TODO: rating flow
          title="Rate"
        />
      </div>
    </div>
  );
}

function ActionButton({
  icon,
  active,
  pending,
  onClick,
  title,
}: {
  icon: React.ReactNode;
  active: boolean;
  pending: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={pending}
      className={`h-full w-full min-h-[44px] flex items-center justify-center transition-all duration-200 ease-out active:scale-[0.98] disabled:cursor-not-allowed touch-manipulation ${
        active
          ? "text-white bg-white/10 hover:bg-white/15"
          : "text-surface-400 hover:text-white hover:bg-white/10 active:bg-white/15"
      } disabled:opacity-50`}
      aria-label={title}
    >
      {pending ? (
        <span className="flex items-center justify-center animate-spin" aria-hidden="true">
          <AiOutlineLoading3Quarters className="size-5" />
        </span>
      ) : (
        icon
      )}
    </button>
  );
}
