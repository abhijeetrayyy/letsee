"use client";

import React, { useState, useContext } from "react";
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
}) => {
  const [modal, setModal] = useState(false);
  const {
    loading,
    user,
    pendingAction,
    togglePreference,
  } = useContext(UserPrefrenceContext);

  const isThisButtonPending =
    pendingAction !== null &&
    pendingAction.itemId === itemId &&
    pendingAction.funcType === funcType;

  const disabled = loading || isThisButtonPending;

  const handleModal = () => {
    setModal(!modal);
  };

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
        title={funcType}
        className="h-full w-full flex items-center justify-center text-2xl bg-neutral-800 text-neutral-200 hover:bg-neutral-700 disabled:bg-neutral-600 disabled:cursor-not-allowed transition-colors"
        disabled={disabled}
        aria-busy={isThisButtonPending}
        aria-label={state ? `Remove from ${funcType}` : `Add to ${funcType}`}
      >
        {isThisButtonPending ? (
          <span className="flex items-center justify-center animate-spin" aria-hidden="true">
            <AiOutlineLoading3Quarters />
          </span>
        ) : (
          icon
        )}
      </button>
    </>
  );
};

export default CardMovieButton;
