"use client";
import React, { useState, useRef, useEffect } from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa6";

interface Image {
  file_path: string;
  name?: string;
}

interface ImagesSectionProps {
  movie: {
    title: string;
    adult: boolean;
    name: string;
  };
  Bimages: Image[];
  Pimages: Image[];
}

const ImagesSection: React.FC<ImagesSectionProps> = ({
  movie,
  Bimages,
  Pimages,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<Image | null>(null);
  const [itemWidth, setItemWidth] = useState(200); // Default item width
  const [visibleItems, setVisibleItems] = useState(4); // Default number of visible items

  const images = Bimages.length > 0 ? Bimages : Pimages;
  const displayImages = images.slice(0, 12); // Limit to 12 images

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
  useEffect(() => {
    const calculateItemWidth = () => {
      const element = scrollRef.current;
      if (element) {
        const containerWidth = element.clientWidth;
        const baseItemWidth = 200; // Base width for each item
        const gap = 16; // Gap between items (adjust as needed)
        const peekWidth = containerWidth * 0.15; // 15% of container width for peek

        // Calculate the number of items that can fit in the container
        let itemsPerView = Math.floor(
          (containerWidth - peekWidth) / (baseItemWidth + gap)
        );

        // Ensure itemsPerView is always greater than 2
        if (itemsPerView < 1) {
          itemsPerView = 1; // Set a minimum of 2 items
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
  }, [displayImages]);

  const openModal = (image: Image) => {
    setSelectedImage(image);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedImage(null);
  };

  return (
    <>
      {(Bimages.length > 0 || Pimages.length > 0) && (
        <section className="max-w-6xl w-full mx-auto px-4 py-6">
          <h2 className="text-2xl font-bold text-white mb-4">Images</h2>
          <div className="relative">
            <div
              ref={scrollRef}
              className="flex flex-row gap-4 overflow-x-auto no-scrollbar py-2 pb-1"
            >
              {displayImages.map((item: Image, index: number) => (
                <button
                  type="button"
                  key={index}
                  className="card-item image-item shrink-0 rounded-xl border border-neutral-700 bg-neutral-800/80 overflow-hidden group cursor-pointer hover:border-neutral-500 hover:shadow-lg transition-all duration-200 text-left"
                  onClick={() => openModal(item)}
                  style={{ width: `${itemWidth}px` }}
                >
                  <img
                    className="w-full aspect-video object-cover transition-opacity duration-200 group-hover:opacity-80"
                    src={
                      movie.adult
                        ? "/pixeled.webp"
                        : `https://image.tmdb.org/t/p/w500${item.file_path}`
                    }
                    alt={item.name || `Image ${index + 1}`}
                  />
                </button>
              ))}
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
                aria-label="Scroll images left"
              >
                <FaChevronLeft size={18} />
              </button>
            )}
            {canScrollRight && (
              <button
                type="button"
                onClick={scrollRight}
                className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 bg-neutral-800 text-neutral-100 p-2.5 rounded-full hover:bg-neutral-700 transition-colors duration-200 z-10 shadow-lg items-center justify-center"
                aria-label="Scroll images right"
              >
                <FaChevronRight size={18} />
              </button>
            )}
          </div>
        </section>
      )}

      {/* Modal */}
      {isModalOpen && selectedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="relative w-full max-w-5xl h-[90vh] bg-neutral-900 rounded-lg flex flex-col md:flex-row overflow-hidden">
            {/* Main Image */}
            <div className="w-full md:w-3/4 h-3/4 md:h-full flex items-center justify-center">
              <img
                src={
                  movie.adult
                    ? "/pixeled.webp"
                    : `https://image.tmdb.org/t/p/w1280${selectedImage.file_path}`
                }
                alt={selectedImage.name || "Selected Image"}
                className="w-full h-full object-contain"
              />
              <button
                onClick={closeModal}
                className="absolute top-2 left-2 bg-neutral-800 text-white p-2 w-10 h-10 rounded-full hover:bg-neutral-700 transition-colors duration-200"
              >
                X
              </button>
            </div>

            {/* Sidebar with Thumbnails */}
            <div className="w-full md:w-1/4 h-1/4 md:h-full bg-neutral-800 overflow-y-auto no-scrollbar">
              <div className="flex flex-row md:flex-col gap-2 p-2">
                {displayImages.map((item: Image, index: number) => (
                  <img
                    key={index}
                    src={
                      movie.adult
                        ? "/pixeled.webp"
                        : `https://image.tmdb.org/t/p/w200${item.file_path}`
                    }
                    alt={item.name || `Thumbnail ${index + 1}`}
                    className={`w-[15rem] h-auto object-cover rounded-md cursor-pointer transition-opacity duration-300 hover:opacity-80 ${
                      selectedImage.file_path === item.file_path
                        ? "border-2 border-white opacity-100"
                        : "opacity-60"
                    }`}
                    onClick={() => setSelectedImage(item)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ImagesSection;
