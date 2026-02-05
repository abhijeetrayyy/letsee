"use client";
import MediaCard from "@/components/cards/MediaCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { GenreList } from "@/staticData/genreList";
import SendMessageModal from "@components/message/sendCard";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useState } from "react";

function Page() {
  const [Sresults, setSResults] = useState([]) as any;
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cardData, setCardData] = useState([]) as any;

  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const { id } = params;
  const rawId = Array.isArray(id) ? id[0] : (id as string) || "";
  const decodedId = decodeURIComponent(rawId);
  const [genreId, ...nameParts] = decodedId.split("-");
  const genreName = nameParts.join("-") || decodedId;

  const page = Number(searchParams.get("page")) || 1;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/genreSearchtv", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ genreId, page }),
        });

        if (!response.ok) {
          throw new Error("Network response was not ok");
        }

        const data = await response.json();

        setSResults(data);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
      setLoading(false);
    };

    if (genreId) {
      fetchData();
    }
  }, [genreId, page]);

  const handleCardTransfer = (data: any) => {
    setCardData(data);
    setIsModalOpen(true);
  };
  const changePage = (newPage: number) => {
    setLoading(true);
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set("page", newPage.toString());
    router.push(
      `/app/tvbygenre/list/${encodeURIComponent(
        decodedId
      )}?${newSearchParams.toString()}`
    );
  };

  return (
    <div className="min-h-screen mx-auto w-full max-w-7xl">
      <SendMessageModal
        media_type={"tv"}
        data={cardData}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
      <div>
        <p>
          Search Results: {genreName} &apos;
          {Sresults?.total_results}&apos; items
        </p>
      </div>
      {loading ? (
        <div className="min-h-[50vh] w-full flex flex-col justify-center items-center gap-4">
          <LoadingSpinner size="lg" className="border-t-white" />
          <p className="text-neutral-400 text-sm animate-pulse">Loading…</p>
        </div>
      ) : (
        <div>
          <div className="text-white  w-full my-4">
            <div className="w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {Sresults?.results?.map((data: any) => {
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
                    mediaType="tv"
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
      )}
      {Sresults?.total_pages > 1 && (
        <div className="flex flex-row justify-center items-center ">
          <div className=" my-3 ">
            <button
              className="px-4 py-2 bg-neutral-700 rounded-md hover:bg-neutral-600"
              onClick={() => changePage(page - 1)}
              disabled={page === 1}
            >
              Last
            </button>
            <span className="mx-4">
              Page {page} of {Sresults.total_pages}
            </span>
            <button
              className="px-4 py-2 bg-neutral-700 rounded-md hover:bg-neutral-600"
              onClick={() => changePage(page + 1)}
              disabled={page === Sresults.total_pages}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Page;
