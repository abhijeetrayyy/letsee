"use client";
import React, { useEffect, useRef, useState } from "react";
import MediaCard from "@/components/cards/MediaCard";
import SendMessageModal from "@components/message/sendCard";
import { IoIosArrowForward } from "react-icons/io";
import { IoIosArrowBack } from "react-icons/io";

const INITIAL_SHOW = 8;

function WatchLaterList({ watchlist, watchlistCount }: any) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cardData, setCardData] = useState<any>(null);
  const [showAll, setShowAll] = useState(false);

  const list = watchlist ?? [];
  const displayed = showAll ? list : list.slice(0, INITIAL_SHOW);
  const hasMore = list.length > INITIAL_SHOW && !showAll;
  const remaining = list.length - INITIAL_SHOW;

  const handleScroll = () => {
    const element = scrollRef.current;
    if (element) {
      const { scrollLeft, scrollWidth, clientWidth } = element;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(
        scrollWidth > clientWidth && scrollLeft < scrollWidth - clientWidth
      );
    }
  };

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -400, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 400, behavior: "smooth" });
    }
  };

  useEffect(() => {
    const element = scrollRef.current;
    if (element) {
      element.addEventListener("scroll", handleScroll);
      handleScroll();

      return () => element.removeEventListener("scroll", handleScroll);
    }
  }, [displayed.length]);

  const handleShare = (item: any) => {
    setCardData({
      id: item.item_id,
      media_type: item.item_type,
      title: item.item_name,
      name: item.item_name,
      poster_path: item.image_url,
    });
    setIsModalOpen(true);
  };

  return (
    <div className="my-10">
      <SendMessageModal
        data={cardData}
        media_type={cardData?.media_type ?? null}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
      <div className="my-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">
          WatchLater &quot;{watchlistCount}&quot;
        </h1>
        {hasMore && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="text-sm font-medium text-indigo-400 hover:text-indigo-300"
          >
            View more ({remaining} more)
          </button>
        )}
      </div>
      <div className="relative w-full">
        <div
          ref={scrollRef}
          className="w-full flex flex-row overflow-x-scroll thin-scroll gap-3 pb-3"
        >
          {displayed.map((item: any) => (
            <MediaCard
              key={item.id}
              id={Number(item.item_id)}
              title={item.item_name}
              mediaType={item.item_type === "tv" ? "tv" : "movie"}
              posterPath={item.image_url}
              adult={!!item.item_adult}
              genres={item.genres ?? []}
              showActions={true}
              onShare={() => handleShare(item)}
              typeLabel={item.item_type}
              className="w-28 md:w-[11rem] shrink-0"
            />
          ))}
        </div>
        {canScrollLeft && (
          <button
            onClick={scrollLeft}
            className="absolute left-0 top-1/2 transform -translate-y-1/2 bg-neutral-600 p-2 py-5 rounded-sm "
            style={{
              boxShadow: "0 4px 15px rgba(0, 0, 0, 0.9)", // Outer shadow
            }}
          >
            <IoIosArrowBack />
          </button>
        )}
        {canScrollRight && (
          <button
            onClick={scrollRight}
            className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-neutral-600 p-2 py-5 rounded-sm "
            style={{
              boxShadow: "0 4px 15px rgba(0, 0, 0, .9)", // Outer shadow
            }}
          >
            <IoIosArrowForward />
          </button>
        )}
      </div>
    </div>
  );
}

export default WatchLaterList;
