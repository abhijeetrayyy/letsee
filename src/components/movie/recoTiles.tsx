"use client";
import React, { useState, useEffect, useRef } from "react";
import SendMessageModal from "@components/message/sendCard";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa6";
import { GenreList } from "@/staticData/genreList";
import MediaCard from "@components/cards/MediaCard";

interface MovieRecoTileProps {
  data: {
    results?: Array<{
      id: number;
      media_type?: string;
      name?: string;
      title?: string;
      poster_path: string;
      adult: boolean;
      genre_ids: number[];
    }>;
  };
  title: string;
  type: string;
  /** Section heading (e.g. "More like this" or "Similar to this"). Default: "More like this" */
  sectionTitle?: string;
}

export default function MovieRecoTile({
  data,
  title,
  type,
  sectionTitle = "More like this",
}: MovieRecoTileProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cardData, setCardData] = useState<any>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [itemWidth, setItemWidth] = useState(200); // Default item width
  const [visibleItems, setVisibleItems] = useState(4); // Default number of visible items

  const handleCardTransfer = (data: any) => {
    setCardData(data);
    setIsModalOpen(true);
  };

  const handleScroll = () => {
    const element = scrollRef.current;
    if (element) {
      const { scrollLeft, scrollWidth, clientWidth } = element;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
    }
  };

  const scrollLeft = () => {
    const element = scrollRef.current;
    if (element) {
      const itemWidth =
        element.querySelector(".image-item")?.clientWidth || 300;
      element.scrollBy({ left: -itemWidth * 2, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    const element = scrollRef.current;
    if (element) {
      const itemWidth =
        element.querySelector(".image-item")?.clientWidth || 300;
      element.scrollBy({ left: itemWidth * 2, behavior: "smooth" });
    }
  };

  // Calculate item width dynamically
  useEffect(() => {
    const calculateItemWidth = () => {
      const element = scrollRef.current;
      if (element) {
        const containerWidth = element.clientWidth;
        const baseItemWidth = 150; // Base width for each item
        const gap = 16; // Gap between items (adjust as needed)
        const peekWidth = containerWidth * 0.15; // 15% of container width for peek

        // Calculate the number of items that can fit in the container
        let itemsPerView = Math.floor(
          (containerWidth - peekWidth) / (baseItemWidth + gap)
        );

        // Ensure itemsPerView is always greater than 2
        if (itemsPerView < 2) {
          itemsPerView = 2; // Set a minimum of 2 items
        }

        // Adjust the item width to fit the calculated number of items
        const adjustedItemWidth =
          (containerWidth - peekWidth - gap * itemsPerView) / itemsPerView;

        setItemWidth(adjustedItemWidth);
        setVisibleItems(itemsPerView);
      }
    };

    calculateItemWidth();
    window.addEventListener("resize", calculateItemWidth);
    return () => window.removeEventListener("resize", calculateItemWidth);
  }, []);

  useEffect(() => {
    const element = scrollRef.current;
    if (element) {
      element.addEventListener("scroll", handleScroll);
      setTimeout(handleScroll, 100); // Initial check
      return () => element.removeEventListener("scroll", handleScroll);
    }
  }, [data]);

  const results = data?.results || [];

  return (
    <section className="max-w-6xl w-full mx-auto px-4 py-6">
      <SendMessageModal
        media_type={cardData?.media_type}
        data={cardData}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
      <h2 className="text-2xl font-bold text-white mb-4">{sectionTitle}</h2>
      <div className="relative">
        <div
          ref={scrollRef}
          className="flex flex-row gap-4 py-2 overflow-x-auto no-scrollbar pb-1"
        >
          {results.length > 0 ? (
            results.map((item: any) => {
              const genreIds = item.genre_ids ?? [];
              const genres = genreIds
                .map((id: number) => GenreList.genres.find((g: any) => g.id === id)?.name)
                .filter(Boolean);
              return (
                <MediaCard
                  key={item.id}
                  id={item.id}
                  title={item.name || item.title}
                  mediaType={item.media_type ?? type}
                  posterPath={item.poster_path}
                  adult={item.adult}
                  genres={genres}
                  showActions
                  onShare={(e) => {
                    e.preventDefault();
                    handleCardTransfer(item);
                  }}
                  typeLabel={type}
                  className="card-item image-item"
                  style={{ width: `${itemWidth}px` }}
                />
              );
            })
          ) : (
            <p className="text-neutral-400 text-sm py-8 w-full text-center">
              No similar titles found
            </p>
          )}
        </div>

        <div
          className={`hidden md:block absolute top-0 left-0 h-full w-12 sm:w-20 bg-gradient-to-r from-neutral-950 to-transparent pointer-events-none transition-opacity duration-300 ${
            canScrollLeft ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden
        />
        <div
          className={`hidden md:block absolute top-0 right-0 h-full w-12 sm:w-20 bg-gradient-to-l from-neutral-950 to-transparent pointer-events-none transition-opacity duration-300 ${
            canScrollRight ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden
        />

        {canScrollLeft && (
          <button
            type="button"
            onClick={scrollLeft}
            className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 bg-neutral-800 text-neutral-100 p-2.5 rounded-full hover:bg-neutral-700 transition-colors duration-200 z-10 shadow-lg items-center justify-center"
            aria-label="Scroll left"
          >
            <FaChevronLeft size={18} />
          </button>
        )}
        {canScrollRight && (
          <button
            type="button"
            onClick={scrollRight}
            className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 bg-neutral-800 text-neutral-100 p-2.5 rounded-full hover:bg-neutral-700 transition-colors duration-200 z-10 shadow-lg items-center justify-center"
            aria-label="Scroll right"
          >
            <FaChevronRight size={18} />
          </button>
        )}
      </div>
    </section>
  );
}
