"use client";

import React, { useState, useContext, useEffect } from "react";
import UserPrefrenceContext from "@/app/contextAPI/userPrefrence";
import type { PreferenceType } from "@/app/contextAPI/userPrefrence";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import toast from "react-hot-toast";
import Link from "next/link";

export interface CardMovieButtonProps {
  icon: React.ReactNode;
  name: string;
  itemId: number;
  funcType: PreferenceType;
  mediaType: string;
  imgUrl: string;
  adult: boolean;
  state: boolean;
  genres: string[];
  /** Optional label shown next to icon (e.g. "Watched"). Used in detail variant. */
  label?: string;
  /** When set, clicking "Watched" (add) for TV opens this instead of calling API. Used for Mark TV Watched modal. */
  onCustomWatchedAdd?: () => void;
}

const CardMovieButton: React.FC<CardMovieButtonProps> = ({
  icon,
  name,
  itemId,
  funcType,
  mediaType,
  imgUrl,
  adult,
  state,
  genres,
  label,
  onCustomWatchedAdd,
}) => {
  const [modal, setModal] = useState(false);
  const [unwatchedConfirmOpen, setUnwatchedConfirmOpen] = useState(false);
  const {
    loading,
    user,
    pendingActions,
    togglePreference,
  } = useContext(UserPrefrenceContext);

  const isThisButtonPending = pendingActions.some(
    (p) => p.itemId === itemId && p.funcType === funcType
  );

  const disabled = loading || isThisButtonPending;

  const handleModal = () => {
    setModal(!modal);
  };

  const performUnwatched = async (keepData: boolean) => {
    setUnwatchedConfirmOpen(false);
    const toastId = toast.loading(keepData ? "Removing from watched…" : "Removing and deleting…");
    const result = await togglePreference({
      funcType: "watched",
      itemId,
      name,
      mediaType,
      imgUrl,
      adult,
      genres,
      currentState: true,
      keepData,
    });
    if (result.ok) {
      toast.success(
        keepData
          ? "Removed from Watched. Your rating, diary and public review are kept."
          : (result.message ?? "Removed from watched"),
        { id: toastId }
      );
    } else {
      toast.error(result.message ?? "Failed to remove from watched", { id: toastId });
    }
  };

  useEffect(() => {
    if (!unwatchedConfirmOpen) return;
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setUnwatchedConfirmOpen(false);
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [unwatchedConfirmOpen]);

  const handleAction = async () => {
    if (disabled) {
      toast.loading("Processing...");
      return;
    }
    if (!user) {
      toast.error("Please log in to save preferences.");
      setModal(true);
      return;
    }
    if (funcType === "watched" && mediaType === "tv" && !state && onCustomWatchedAdd) {
      onCustomWatchedAdd();
      return;
    }

    if (funcType === "watched" && state) {
      setUnwatchedConfirmOpen(true);
      return;
    }

    const actionText = state ? "Removed from" : "Added to";
    const toastId = toast.loading(`${actionText} ${funcType}...`);

    const result = await togglePreference({
      funcType,
      itemId,
      name,
      mediaType,
      imgUrl,
      adult,
      genres,
      currentState: state,
    });

    if (result.ok) {
      toast.success(
        result.message ?? `${actionText} ${funcType} successfully`,
        { id: toastId }
      );
    } else {
      toast.error(
        result.message ?? `Failed to update ${funcType}`,
        { id: toastId }
      );
    }
  };

  return (
    <>
      {/* Unwatched confirmation: user chooses whether to remove (and delete rating/reviews) or cancel */}
      {unwatchedConfirmOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
          aria-modal="true"
          role="dialog"
          aria-labelledby="unwatched-dialog-title"
          aria-describedby="unwatched-dialog-desc"
          onClick={() => setUnwatchedConfirmOpen(false)}
        >
          <div
            className="relative w-full max-w-md rounded-2xl border border-neutral-600 bg-neutral-900 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-700 px-4 py-3">
              <h3 id="unwatched-dialog-title" className="text-lg font-semibold text-white">
                Remove from Watched?
              </h3>
              <button
                type="button"
                onClick={() => setUnwatchedConfirmOpen(false)}
                className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white"
                aria-label="Close (keep as watched)"
              >
                ✕
              </button>
            </div>
            <div id="unwatched-dialog-desc" className="px-4 py-4">
              <p className="text-neutral-300 mb-2">
                Remove <span className="font-medium text-white">&quot;{name}&quot;</span> from Watched?
              </p>
              <p className="text-sm text-neutral-400 mb-3">
                You can keep your rating, diary and public review so they still appear on this title, or remove and delete everything.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setUnwatchedConfirmOpen(false)}
                  className="order-3 sm:order-1 px-4 py-2.5 rounded-xl border border-neutral-600 bg-neutral-800 text-neutral-200 font-medium hover:bg-neutral-700"
                >
                  No, keep it watched
                </button>
                <button
                  type="button"
                  onClick={() => performUnwatched(true)}
                  disabled={isThisButtonPending}
                  className="order-2 px-4 py-2.5 rounded-xl border border-amber-500/60 bg-amber-500/10 text-amber-400 font-medium hover:bg-amber-500/20 disabled:opacity-50"
                >
                  Remove but keep rating, diary &amp; review
                </button>
                <button
                  type="button"
                  onClick={() => performUnwatched(false)}
                  disabled={isThisButtonPending}
                  className="order-1 sm:order-3 px-4 py-2.5 rounded-xl bg-red-600 text-white font-medium hover:bg-red-500 disabled:opacity-50"
                >
                  Yes, remove and delete everything
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-neutral-700 w-full h-fit max-w-3xl sm:rounded-lg p-5 shadow-xl">
            <div className="flex justify-between items-center p-4 border-b border-neutral-600">
              <Link
                className="bg-blue-600 hover:bg-blue-700 rounded-md px-3 py-2 text-white text-lg font-semibold"
                href="/login"
              >
                Log in
              </Link>
              <button
                type="button"
                onClick={handleModal}
                className="text-white hover:text-gray-300 p-1"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              <p className="text-white">Log in to save watched, favorites, and watchlist.</p>
            </div>
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={user ? handleAction : handleModal}
        title={state ? `Remove from ${funcType}` : `Add to ${funcType}`}
        className={`h-full w-full min-h-[44px] flex items-center justify-center gap-2 transition-colors disabled:cursor-not-allowed touch-manipulation ${
          label
            ? "px-4 py-3 rounded-xl text-base font-medium bg-neutral-700/80 text-neutral-200 hover:bg-neutral-600 border border-neutral-600 hover:border-neutral-500 disabled:opacity-60 disabled:bg-neutral-700/50"
            : "text-neutral-300 hover:text-white hover:bg-white/10 active:bg-white/15 disabled:opacity-50 disabled:bg-transparent"
        }`}
        disabled={disabled}
        aria-busy={isThisButtonPending}
        aria-label={state ? `Remove from ${funcType}` : `Add to ${funcType}`}
      >
        {isThisButtonPending ? (
          <span className="flex items-center justify-center animate-spin" aria-hidden="true">
            <AiOutlineLoading3Quarters className={label ? "shrink-0 text-lg" : ""} />
          </span>
        ) : (
          <>
            <span className={label ? "shrink-0 text-lg" : ""}>{icon}</span>
            {label && <span>{label}</span>}
          </>
        )}
      </button>
    </>
  );
};

export default CardMovieButton;
