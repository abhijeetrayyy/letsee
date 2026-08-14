"use client";

import UserPrefrenceContext from "@/app/contextAPI/userPrefrence";
import { useContext } from "react";
import { getPosterUrl } from "@/utils/imageUrl";
import { CiHeart } from "react-icons/ci";
import { FcLike } from "react-icons/fc";
import CardMovieButton from "./cardButtons";
import StatusControl from "./StatusControl";

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
  /** Receives the status the user picked, or null for plain episode editing. */
  onAddWatchedTv?: (intended: import("@/app/contextAPI/userPrefrence").MediaStatus | null) => void;
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
  // Status now lives in StatusControl; only favorite is read here.
  const { hasFavorite } = useContext(UserPrefrenceContext);

  const id = Number(cardId);
  const adult = cardAdult ?? false;
  // cardImg may be a raw TMDB path (e.g. "/abc.jpg") or an already-resolved
  // URL depending on the caller — normalize here so whatever gets saved to
  // the DB (via user-media-status) is always a real, loadable URL.
  const imgUrl = cardImg?.trim() ? getPosterUrl(cardImg, "w342") : undefined;
  const genreList = (genres ?? []).filter(
    (g): g is string => g != null && typeof g === "string",
  );
  const favorite = hasFavorite(cardId);

  const shared = {
    genres: genreList,
    itemId: id,
    mediaType: cardType,
    name: cardName,
    adult,
    imgUrl,
  };

  // Watching / Watched / Watchlist are one database column, so they get one
  // control. Favorite is a genuinely separate flag, so it keeps its own toggle
  // and no longer clears your status when you tap it.
  const statusProps = {
    itemId: cardId,
    mediaType: cardType,
    name: cardName,
    imgUrl,
    adult,
    genres: genreList,
    onWatchedTv: cardType === "tv" ? onAddWatchedTv : undefined,
  };

  if (variant === "detail") {
    return (
      <>
        <StatusControl {...statusProps} variant="detail" />
        <CardMovieButton
          {...shared}
          state={favorite}
          funcType="favorite"
          label="Favorite"
          icon={
            favorite ? (
              <FcLike className="shrink-0" />
            ) : (
              <CiHeart className="shrink-0" />
            )
          }
        />
      </>
    );
  }

  return (
    <div className="w-full">
      <div className="w-full h-12 grid grid-cols-[1fr_auto] gap-px bg-white/5">
        <StatusControl {...statusProps} variant="compact" />
        <CardMovieButton
          {...shared}
          state={favorite}
          funcType="favorite"
          icon={
            favorite ? (
              <FcLike className="size-5" />
            ) : (
              <CiHeart className="size-5 text-surface-400" />
            )
          }
        />
      </div>
    </div>
  );
}
