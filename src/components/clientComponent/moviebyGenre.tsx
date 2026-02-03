"use client";

import React, { useState } from "react";
import MediaCard from "@/components/cards/MediaCard";
import SendMessageModal from "@components/message/sendCard";
import { GenreList } from "@/staticData/genreList";

interface Movie {
  id: number;
  title: string;
  name: string;
  release_date: string;
  first_air_date: string;
  poster_path: string;
  backdrop_path: string;
  media_type: string;
  adult: boolean;
  genre_ids: any;
}

interface MovieByGenreProps {
  Sresults: {
    results: Movie[];
  };
}

function MovieByGenre({ Sresults }: MovieByGenreProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cardData, setCardData] = useState<Movie | null>(null);

  const handleCardTransfer = (data: Movie) => {
    setCardData(data);
    setIsModalOpen(true);
  };

  return (
    <div>
      <SendMessageModal
        media_type={"movie"}
        data={cardData ? { ...cardData, id: cardData.id.toString() } : null}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
      <div>
        <div className="text-white w-full my-4">
          <div className="w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Sresults?.results?.map((data: Movie) => {
              const title = data.name || data.title;
              const year =
                data.release_date || data.first_air_date
                  ? String(
                      new Date(
                        data.release_date || data.first_air_date
                      ).getFullYear()
                    )
                  : null;
              const genres = (data.genre_ids ?? [])
                .map((id: number) =>
                  GenreList.genres.find((g: any) => g.id === id)?.name
                )
                .filter(Boolean);
              return (
                <MediaCard
                  key={data.id}
                  id={data.id}
                  title={title}
                  mediaType="movie"
                  posterPath={data.poster_path || data.backdrop_path}
                  adult={!!data.adult}
                  genres={genres}
                  showActions={true}
                  onShare={() => handleCardTransfer(data)}
                  year={year}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MovieByGenre;
