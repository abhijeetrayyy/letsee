"use client";

import UserPrefrenceContext from "@/app/contextAPI/userPrefrence";
import { useContext } from "react";
import { CiHeart } from "react-icons/ci";
import { FcLike } from "react-icons/fc";
import { MdOutlineWatchLater, MdLiveTv } from "react-icons/md";
import { PiEyeBold } from "react-icons/pi";
import { RiEyeCloseLine } from "react-icons/ri";
import CardMovieButton from "./cardButtons";

export type ThreePreferenceBtnProps = {
  /** Movie/TV/person ID (number or string from DB). */
  cardId: number | string;
  cardType: string;
  cardName: string;
  cardAdult?: boolean;
  cardImg?: string | null;
  /** Genre names or IDs; nulls are filtered out. */
  genres: (string | null)[];
  /** Optional extra data (e.g. for AI reco); not used by preference logic. */
  data?: unknown;
  /** "compact" = icon-only grid (cards); "detail" = pill buttons with labels (detail pages). */
  variant?: "compact" | "detail";
  /** When set for TV, clicking "Watched" (add) opens this instead of toggling. Used for Mark TV Watched modal. */
  onAddWatchedTv?: () => void;
};

export default function ThreePrefrencebtn({
  cardId,
  cardType,
  cardName,
  cardAdult,
  cardImg,
  genres,
  data: _data,
  variant = "compact",
  onAddWatchedTv,
}: ThreePreferenceBtnProps) {
  const { hasWatched, hasFavorite, hasWatchLater, hasWatching } =
    useContext(UserPrefrenceContext);

  const id = Number(cardId);
  const adult = cardAdult ?? false;
  const imgUrl = cardImg ?? "";
  const genreList = (genres ?? []).filter(
    (g): g is string => g != null && typeof g === "string",
  );
  const watched = hasWatched(cardId);
  const favorite = hasFavorite(cardId);
  const watchLater = hasWatchLater(cardId);
  const watching = hasWatching(cardId);

  const shared = {
    genres: genreList,
    itemId: id,
    mediaType: cardType,
    name: cardName,
    adult,
    imgUrl,
  };

  if (variant === "detail") {
    return (
      <>
        <CardMovieButton
          {...shared}
          state={watching}
          funcType="watching"
          label="Watching"
          icon={
            watching ? (
              <MdLiveTv className="text-amber-400 shrink-0" />
            ) : (
              <MdLiveTv className="shrink-0" />
            )
          }
        />
        <CardMovieButton
          {...shared}
          state={watched}
          funcType="watched"
          label="Watched"
          onCustomWatchedAdd={cardType === "tv" ? onAddWatchedTv : undefined}
          icon={
            watched ? (
              <PiEyeBold className="text-green-500 shrink-0" />
            ) : (
              <RiEyeCloseLine className="shrink-0" />
            )
          }
        />
        <CardMovieButton
          {...shared}
          state={favorite}
          funcType="favorite"
          label="Favorites"
          icon={
            favorite ? (
              <FcLike className="shrink-0" />
            ) : (
              <CiHeart className="shrink-0" />
            )
          }
        />
        <CardMovieButton
          {...shared}
          state={watchLater}
          funcType="watchlater"
          label="Watchlist"
          icon={
            watchLater ? (
              <MdOutlineWatchLater className="font-bold text-green-500 shrink-0" />
            ) : (
              <MdOutlineWatchLater className="shrink-0" />
            )
          }
        />
      </>
    );
  }

  return (
    <div className="w-full">
      <div className="w-full h-12 grid grid-cols-4 gap-px bg-white/5">
        <CardMovieButton
          {...shared}
          state={watching}
          funcType="watching"
          icon={
            watching ? (
              <MdLiveTv className="text-amber-400 size-5" />
            ) : (
              <MdLiveTv className="size-5 text-neutral-400" />
            )
          }
        />
        <CardMovieButton
          {...shared}
          state={watched}
          funcType="watched"
          onCustomWatchedAdd={cardType === "tv" ? onAddWatchedTv : undefined}
          icon={
            watched ? (
              <PiEyeBold className="text-emerald-400 size-5" />
            ) : (
              <RiEyeCloseLine className="size-5 text-neutral-400" />
            )
          }
        />
        <CardMovieButton
          {...shared}
          state={favorite}
          funcType="favorite"
          icon={
            favorite ? (
              <FcLike className="size-5" />
            ) : (
              <CiHeart className="size-5 text-neutral-400" />
            )
          }
        />
        <CardMovieButton
          {...shared}
          state={watchLater}
          funcType="watchlater"
          icon={
            watchLater ? (
              <MdOutlineWatchLater className="size-5 text-emerald-400 font-bold" />
            ) : (
              <MdOutlineWatchLater className="size-5 text-neutral-400" />
            )
          }
        />
      </div>
    </div>
  );
}
