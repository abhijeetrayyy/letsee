"use client";

import UserPrefrenceContext from "@/app/contextAPI/userPrefrence";
import { useContext } from "react";
import { CiHeart } from "react-icons/ci";
import { FcLike } from "react-icons/fc";
import { MdOutlineWatchLater } from "react-icons/md";
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
};

export default function ThreePrefrencebtn({
  cardId,
  cardType,
  cardName,
  cardAdult,
  cardImg,
  genres,
  data: _data,
}: ThreePreferenceBtnProps) {
  const {
    hasWatched,
    hasFavorite,
    hasWatchLater,
  } = useContext(UserPrefrenceContext);

  const id = Number(cardId);
  const adult = cardAdult ?? false;
  const imgUrl = cardImg ?? "";
  const genreList = (genres ?? []).filter(
    (g): g is string => g != null && typeof g === "string"
  );
  const watched = hasWatched(cardId);
  const favorite = hasFavorite(cardId);
  const watchLater = hasWatchLater(cardId);

  return (
    <div>
      <div className="w-full bg-neutral-900 overflow-hidden">
        <div className="w-full h-14 grid grid-cols-3">
          <CardMovieButton
            genres={genreList}
            itemId={id}
            mediaType={cardType}
            name={cardName}
            state={watched}
            funcType="watched"
            adult={adult}
            imgUrl={imgUrl}
            icon={
              watched ? (
                <PiEyeBold className="text-green-600" />
              ) : (
                <RiEyeCloseLine />
              )
            }
          />
          <CardMovieButton
            genres={genreList}
            itemId={id}
            mediaType={cardType}
            name={cardName}
            state={favorite}
            funcType="favorite"
            adult={adult}
            imgUrl={imgUrl}
            icon={favorite ? <FcLike /> : <CiHeart />}
          />
          <CardMovieButton
            genres={genreList}
            itemId={id}
            mediaType={cardType}
            name={cardName}
            state={watchLater}
            funcType="watchlater"
            adult={adult}
            imgUrl={imgUrl}
            icon={
              watchLater ? (
                <MdOutlineWatchLater className="font-bold text-green-500" />
              ) : (
                <MdOutlineWatchLater />
              )
            }
          />
        </div>
      </div>
    </div>
  );
}
