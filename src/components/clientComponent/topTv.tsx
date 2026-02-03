"use client";
import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import MediaCard from "@/components/cards/MediaCard";
import SendMessageModal from "@components/message/sendCard";
import MarkTVWatchedModal from "@components/tv/MarkTVWatchedModal";
import UserPrefrenceContext from "@/app/contextAPI/userPrefrence";
import { GenreList } from "@/staticData/genreList";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa6";

export default function tvTop({ TrendingTv }: any) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cardData, setCardData] = useState([]) as any;
  const [tvWatchedModalOpen, setTvWatchedModalOpen] = useState(false);
  const [tvWatchedModalItem, setTvWatchedModalItem] = useState<{
    id: number;
    name: string;
    posterPath: string | null;
    adult: boolean;
    genres: string[];
  } | null>(null);
  const { refreshPreferences } = useContext(UserPrefrenceContext);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const handleCardTransfer = (data: any) => {
    setCardData(data);
    setIsModalOpen(true);
  };
  const openTvWatchedModal = useCallback((item: any) => {
    const genres = (item.genre_ids ?? [])
      .map((id: number) => GenreList.genres.find((g: any) => g.id === id)?.name)
      .filter(Boolean);
    setTvWatchedModalItem({
      id: item.id,
      name: item.name || item.title || "Unknown",
      posterPath: item.poster_path || item.backdrop_path || null,
      adult: !!item.adult,
      genres,
    });
    setTvWatchedModalOpen(true);
  }, []);
  const closeTvWatchedModal = useCallback(() => {
    setTvWatchedModalOpen(false);
    setTvWatchedModalItem(null);
  }, []);
  const onTvWatchedSuccess = useCallback(() => {
    closeTvWatchedModal();
    refreshPreferences?.();
  }, [closeTvWatchedModal, refreshPreferences]);
  const handleScroll = () => {
    const element = scrollRef.current;
    if (element) {
      const { scrollLeft, scrollWidth, clientWidth } = element;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10); // Buffer
    }
  };

  const scrollLeft = () => {
    const element = scrollRef.current;
    if (element) {
      const itemWidth = element.querySelector(".card-item")?.clientWidth || 200; // Default 200px
      const shift = window.innerWidth < 640 ? itemWidth * 2 : itemWidth * 3; // 2 on mobile, 5 on desktop
      element.scrollBy({ left: -shift, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    const element = scrollRef.current;
    if (element) {
      const itemWidth = element.querySelector(".card-item")?.clientWidth || 200;
      const shift = window.innerWidth < 640 ? itemWidth * 2 : itemWidth * 3;
      element.scrollBy({ left: shift, behavior: "smooth" });
    }
  };

  useEffect(() => {
    const element = scrollRef.current;
    if (element) {
      element.addEventListener("scroll", handleScroll);
      setTimeout(handleScroll, 100); // Initial check
      return () => element.removeEventListener("scroll", handleScroll);
    }
  }, [TrendingTv]);
  return (
    <div>
      <SendMessageModal
        media_type={"tv"}
        data={cardData}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
      {tvWatchedModalItem && (
        <MarkTVWatchedModal
          showId={String(tvWatchedModalItem.id)}
          showName={tvWatchedModalItem.name}
          seasons={[]}
          isOpen={tvWatchedModalOpen}
          onClose={closeTvWatchedModal}
          onSuccess={onTvWatchedSuccess}
          watchedPayload={{
            itemId: tvWatchedModalItem.id,
            name: tvWatchedModalItem.name,
            imgUrl: tvWatchedModalItem.posterPath
              ? `https://image.tmdb.org/t/p/w342${tvWatchedModalItem.posterPath}`
              : "",
            adult: tvWatchedModalItem.adult,
            genres: tvWatchedModalItem.genres,
          }}
        />
      )}{" "}
      <div className="relative">
        <div
          ref={scrollRef}
          className="flex flex-row gap-4 py-3 overflow-x-auto no-scrollbar"
        >
          {TrendingTv?.results.map((item: any) => {
            const title = item.name || item.title;
            const genres = (item.genre_ids ?? [])
              .map((id: number) =>
                GenreList.genres.find((g: any) => g.id === id)?.name
              )
              .filter(Boolean);
            return (
              <MediaCard
                key={item.id}
                id={item.id}
                title={title}
                mediaType="tv"
                posterPath={item.poster_path || item.backdrop_path}
                adult={!!item.adult}
                genres={genres}
                showActions={true}
                onShare={() => handleCardTransfer(item)}
                onAddWatchedTv={() => openTvWatchedModal(item)}
                className="card-item max-w-[10rem] sm:max-w-[15rem] md:max-w-[20rem] flex-shrink-0"
              />
            );
          })}
        </div>

        {/* Left Fade Overlay */}
        <div
          className={`hidden md:block absolute top-0 left-0 h-full w-12 sm:w-16 bg-gradient-to-r from-black to-transparent pointer-events-none transition-opacity duration-300 ${
            canScrollLeft ? "opacity-80" : "opacity-0"
          }`}
        />

        {/* Right Fade Overlay */}
        <div
          className={`hidden md:block absolute top-0 right-0 h-full w-12 sm:w-16 bg-gradient-to-l from-black to-transparent pointer-events-none transition-opacity duration-300 ${
            canScrollRight ? "opacity-80" : "opacity-0"
          }`}
        />

        {/* Scroll Buttons */}
        {canScrollLeft && (
          <button
            onClick={scrollLeft}
            className="hidden md:block absolute left-2 top-1/2 transform -translate-y-1/2 bg-neutral-800 text-neutral-100 p-2 sm:p-3 rounded-full hover:bg-neutral-700 transition-colors duration-200 z-10 shadow-md"
          >
            <FaChevronLeft size={16} className="" />
          </button>
        )}
        {canScrollRight && (
          <button
            onClick={scrollRight}
            className="hidden md:block absolute right-2 top-1/2 transform -translate-y-1/2 bg-neutral-800 text-neutral-100 p-2 sm:p-3 rounded-full hover:bg-neutral-700 transition-colors duration-200 z-10 shadow-md"
          >
            <FaChevronRight size={16} className="" />
          </button>
        )}
      </div>
    </div>
  );
}
