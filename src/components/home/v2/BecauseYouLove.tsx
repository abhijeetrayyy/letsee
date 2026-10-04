"use client";

import { useContext, useMemo, useState } from "react";
import useSWR from "swr";
import { Shuffle } from "lucide-react";
import TitleCard from "@components/ds/TitleCard";
import UserPrefrenceContext from "@/app/contextAPI/userPrefrence";
import { useToday } from "@/hooks/useToday";
import { fetchFavourites } from "@/lib/db/favourites";
import { swrFetcher } from "@/utils/swrFetcher";
import { getPosterUrl } from "@/utils/imageUrl";
import type { BecauseItem } from "@/utils/title/because";
import { SectionTitle } from "./parts";

import Rail from "@components/ds/Rail";
/**
 * "Because you love Serendipity": a row of what TMDB recommends from one of
 * your favourites, minus anything already in your library.
 *
 * Favourites are the strongest thing anyone tells letsee about their taste
 * (the owner: "you know about any person by their favourites"), and nothing
 * used them to find the next film. One favourite a day, chosen by the date so
 * Home doesn't reshuffle on every visit; "Another" moves to the next. The
 * favourites read is the profile's own cache entry, and the recommendations
 * come from /api/because, cached at the edge per title.
 */
const MIN = 4;

export default function BecauseYouLove({ me }: { me: string }) {
  const { data: favourites } = useSWR(["favourites", me, me], () => fetchFavourites(me), { revalidateOnFocus: false });
  const { getStatus } = useContext(UserPrefrenceContext);
  const today = useToday();
  const [step, setStep] = useState(0);

  const seeds = useMemo(() => (favourites ?? []).filter((f) => f.imageUrl && f.itemName), [favourites]);
  // The reader's date, after mount: the same favourite all day, a new one tomorrow.
  const day = today ? Math.floor(Date.UTC(today.y, today.m - 1, today.d) / 86_400_000) : null;
  const seed = day != null && seeds.length ? seeds[(day + step) % seeds.length] : null;

  const { data } = useSWR<{ items: BecauseItem[] }>(seed ? `/api/because?type=${seed.itemType}&id=${seed.itemId}` : null, swrFetcher, {
    revalidateOnFocus: false,
  });
  const items = (data?.items ?? []).filter((i) => !getStatus(String(i.id), i.type)).slice(0, 12);

  if (!seed || !data || items.length < MIN) return null;

  return (
    <section aria-labelledby="because">
      <SectionTitle
        more={
          seeds.length > 1 ? (
            <button
              type="button"
              onClick={() => setStep((n) => n + 1)}
              className="inline-flex shrink-0 items-center gap-1.5 text-sm text-ink-400 underline decoration-line-input underline-offset-4 hover:text-ink-0"
            >
              <Shuffle className="size-3.5" aria-hidden />
              Another
            </button>
          ) : null
        }
      >
        <span id="because">
          Because you love <em className="italic">{seed.itemName}</em>
        </span>
      </SectionTitle>
      <Rail>
        <ul className="no-scrollbar -mx-4 flex snap-x scroll-px-4 sm:scroll-px-6 lg:scroll-px-8 gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          {items.map((i) => (
            <li key={`${i.type}:${i.id}`} className="w-36 shrink-0 snap-start sm:w-44">
              <TitleCard id={String(i.id)} title={i.title} mediaType={i.type} imageUrl={getPosterUrl(i.posterPath, "w342")} year={i.year} />
            </li>
          ))}
        </ul>
      </Rail>
    </section>
  );
}
