"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { ArrowRight, Heart } from "lucide-react";
import Link from "@components/ui/AppLink";
import TasteInFourStrip from "@components/profile/TasteInFourStrip";
import EditTasteInFour from "@components/profile/EditTasteInFour";
import IdentitySlots from "@components/profile/IdentitySlots";
import { fetchFavouriteKeys, fetchFavourites } from "@/lib/db/favourites";
import { favKey, listWords, sharedFavourites, topGenres, type Favourite } from "@/lib/profile/favourites";
import { getPosterUrl } from "@/utils/imageUrl";
import { titlePath } from "@/utils/urls";

/**
 * Favourites, near the top of a profile (the owner: "you know about any
 * person by their favourites… that is really a good thing to show").
 *
 * The titles someone hearted were only ever read to pick their four from; the
 * profile showed the four and nothing else, so someone with 139 favourites and
 * two chosen looked like they loved two films. Now one section holds both:
 * the four, large, when they've chosen them; then everything else they
 * hearted as a rail, with what it leans toward ("mostly drama, comedy and
 * romance") and, for a visitor, the ones you love too — marked on the poster
 * and named in a line, because a shared favourite is the best reason to talk.
 * Twenty to start; the rest open in place.
 */
type FourItem = { position: number; item_id: string; item_type: string; image_url: string | null; item_name: string };

const RAIL = 20;
/** Below this, "mostly drama" is three films talking, and filters split almost nothing. */
const ENOUGH = 8;
const chip = (on: boolean) =>
  `inline-flex h-8 items-center rounded-full px-3 text-sm font-medium transition-colors ${on ? "bg-action text-on-action" : "text-ink-300 ring-1 ring-inset ring-line-input hover:bg-hover hover:text-ink-0"}`;

export default function ProfileFavourites({
  userId,
  username,
  isOwner,
  viewerId,
  four,
}: {
  userId: string;
  username: string;
  isOwner: boolean;
  viewerId: string | null;
  four: FourItem[];
}) {
  const visitor = !!viewerId && !isOwner;
  // Keyed on the viewer too: what RLS returns depends on who is asking.
  const { data: favourites, error } = useSWR(["favourites", userId, viewerId], () => fetchFavourites(userId), { revalidateOnFocus: false });
  const { data: mine } = useSWR(visitor ? ["favourite-keys", viewerId] : null, () => fetchFavouriteKeys(viewerId!), { revalidateOnFocus: false });
  const [kind, setKind] = useState<"all" | "movie" | "tv">("all");
  const [open, setOpen] = useState(false);

  const all = useMemo(() => favourites ?? [], [favourites]);
  const films = all.filter((f) => f.itemType === "movie").length;
  const series = all.length - films;
  const leans = useMemo(() => (all.length >= ENOUGH ? topGenres(all) : []), [all]);
  const shared = useMemo(() => (mine ? sharedFavourites(all, mine) : []), [all, mine]);
  const sharedKeys = useMemo(() => new Set(shared.map(favKey)), [shared]);
  // The four are favourites too, and already on show above.
  const inFour = useMemo(() => new Set(four.map((f) => `${f.item_type}:${f.item_id}`)), [four]);
  // Not assumed to contain the four: a four can be chosen from what you've watched.
  const others = all.filter((f) => !inFour.has(favKey(f)));
  const rest = others.filter((f) => kind === "all" || f.itemType === kind);
  const shown = open ? rest : rest.slice(0, RAIL);

  // Nothing to show a visitor: no four, and nothing hearted (or not theirs to see).
  if (!isOwner && !four.length && favourites && !all.length) return null;
  if (!isOwner && !four.length && error) return null;

  const counts = [films ? `${films} ${films === 1 ? "film" : "films"}` : null, series ? `${series} series` : null].filter(Boolean).join(" · ");

  return (
    <section aria-labelledby="favourites-title" id="favourites" className="scroll-mt-20">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id="favourites-title" className="text-2xl text-ink-0 sm:text-3xl">
            Favourites
          </h2>
          {all.length > 0 && (
            <p className="mt-1 text-sm text-ink-500">
              {counts}
              {leans.length > 0 && <> · mostly {listWords(leans)}</>}
            </p>
          )}
        </div>
        {isOwner && <EditTasteInFour currentItems={four} profileId={userId} />}
      </div>

      {four.length > 0 && (
        <div className="mt-5">
          <p className="mb-2.5 text-xs font-medium uppercase tracking-wide text-ink-500">{isOwner ? "Your four" : `${username}'s four`}</p>
          <TasteInFourStrip items={four} />
        </div>
      )}
      {isOwner && four.length < 4 && all.length >= 4 && (
        <p className="mt-3 text-sm text-ink-500">
          {four.length ? `${4 - four.length} more to choose for your four.` : "Choose four of these to stand for you."} They lead your profile.
        </p>
      )}

      {shared.length > 0 && (
        <p className="mt-5 flex items-start gap-2 text-sm leading-relaxed text-ink-300">
          <Heart className="mt-0.5 size-4 shrink-0 fill-accent text-accent" aria-hidden />
          <span>
            You both love{" "}
            {shared.slice(0, 2).map((f, i) => (
              <span key={favKey(f)}>
                {i > 0 && (shared.length > 2 ? ", " : " and ")}
                <Link href={titlePath(f.itemType, f.itemId, f.itemName)} className="font-display text-base text-ink-0 hover:underline">
                  {f.itemName}
                </Link>
              </span>
            ))}
            {shared.length > 2 && ` and ${shared.length - 2} more`}.
          </span>
        </p>
      )}

      {!favourites && !error ? (
        <ul className="mt-5 flex gap-3 overflow-hidden" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <li key={i} className="aspect-2/3 w-28 shrink-0 rounded-media bg-raised sm:w-32" />
          ))}
        </ul>
      ) : others.length > 0 ? (
        <div className="mt-5">
          {films > 0 && series > 0 && all.length >= ENOUGH && (
            <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Show">
              {(["all", "movie", "tv"] as const).map((k) => (
                <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={chip(kind === k)}>
                  {k === "all" ? "All" : k === "movie" ? `Films ${films}` : `Series ${series}`}
                </button>
              ))}
            </div>
          )}
          <ul
            className={
              open
                ? "grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-5 lg:grid-cols-8"
                : "no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
            }
          >
            {shown.map((f) => (
              <Poster key={favKey(f)} favourite={f} shared={sharedKeys.has(favKey(f))} rail={!open} />
            ))}
            {!open && rest.length > RAIL && (
              <li className="w-28 shrink-0 snap-start sm:w-32">
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  className="flex aspect-2/3 w-full flex-col items-center justify-center gap-2 rounded-media text-sm font-medium text-ink-200 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover hover:text-ink-0"
                >
                  See all {rest.length}
                  <ArrowRight className="size-4" aria-hidden />
                </button>
              </li>
            )}
          </ul>
          {open && (
            <button type="button" onClick={() => setOpen(false)} className="mt-4 text-sm font-medium text-ink-400 underline decoration-line-input underline-offset-4 hover:text-ink-0">
              Show fewer
            </button>
          )}
        </div>
      ) : (
        !four.length && (
          <p className="mt-3 text-sm text-ink-500">
            {isOwner ? "Heart a film or series on its page and it shows here. It's the first thing people learn about you." : `${username} hasn't hearted anything yet.`}
          </p>
        )
      )}

      <IdentitySlots userId={userId} isOwner={isOwner} />
    </section>
  );
}

function Poster({ favourite: f, shared, rail }: { favourite: Favourite; shared: boolean; rail: boolean }) {
  return (
    <li className={rail ? "w-28 shrink-0 snap-start sm:w-32" : "min-w-0"}>
      <Link href={titlePath(f.itemType, f.itemId, f.itemName)} className="group block">
        <span className="relative block">
          <img
            src={getPosterUrl(f.imageUrl, "w185")}
            alt=""
            loading="lazy"
            decoding="async"
            className={`aspect-2/3 w-full rounded-media bg-hover object-cover transition-opacity group-hover:opacity-90 ${shared ? "ring-2 ring-accent" : "ring-1 ring-inset ring-line-strong"}`}
          />
          {shared && (
            <span className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-page/85">
              <Heart className="size-3.5 fill-accent text-accent" aria-hidden />
              <span className="sr-only">You love it too</span>
            </span>
          )}
        </span>
        <span className="mt-1.5 block truncate text-xs text-ink-400 group-hover:text-ink-0">{f.itemName}</span>
      </Link>
    </li>
  );
}
