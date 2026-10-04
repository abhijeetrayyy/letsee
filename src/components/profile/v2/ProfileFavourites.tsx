"use client";

import { useContext, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import toast from "react-hot-toast";
import { ArrowRight, Heart, HeartOff, Plus } from "lucide-react";
import Link from "@components/ui/AppLink";
import EditTasteInFour, { type FourEditorHandle } from "@components/profile/EditTasteInFour";
import { useMediaInteraction } from "@/app/contextAPI/MediaInteractionProvider";
import UserPrefrenceContext from "@/app/contextAPI/userPrefrence";
import { fetchFavouriteKeys, fetchFavourites } from "@/lib/db/favourites";
import { favKey, listWords, sharedFavourites, topGenres, type Favourite } from "@/lib/profile/favourites";
import { getPosterUrl } from "@/utils/imageUrl";
import { titlePath } from "@/utils/urls";
import ProfileSection, { sectionAction } from "./ProfileSection";

/**
 * What someone loves, as two sections that don't run into each other.
 *
 * They were one section under one "Favourites" heading — the four, then a rail
 * of everything hearted, then the identity cards — and the owner couldn't tell
 * which was which, or where to change each: "very messy… what is favourite,
 * what is the list of favourites, what is taste of four". Now:
 *
 *   **Your four** — four titles chosen to stand for you, large, in four
 *   slots; empty slots are visible to you as "Choose", and open the editor
 *   at that slot. A visitor sees only what was chosen.
 *
 *   **Favourites** — everything hearted, as a grid (one row on a desktop, two
 *   on a phone, then *See all*), with what it leans toward and, for a visitor,
 *   the ones you love too. **Manage** lets the owner take titles out here
 *   rather than visiting each page.
 *
 * The identity cards are their own section too (IdentitySlots, "Picks").
 */
type FourItem = { position: number; item_id: string; item_type: string; image_url: string | null; item_name: string };

/** Below this, "mostly drama" is three films talking, and filters split almost nothing. */
const ENOUGH = 8;
/** A row on a desktop; on a phone the CSS shows the first six — two rows of three. */
const FIRST = 8;
const chip = (on: boolean) =>
  `inline-flex h-8 items-center rounded-full px-3 text-sm font-medium transition-colors ${on ? "bg-action text-on-action" : "text-ink-300 ring-1 ring-inset ring-line-input hover:bg-hover hover:text-ink-0"}`;

/* ── The four ─────────────────────────────────────────────────────────────── */

export function ProfileFour({ userId, username, isOwner, four }: { userId: string; username: string; isOwner: boolean; four: FourItem[] }) {
  const editor = useRef<FourEditorHandle>(null);
  if (!isOwner && !four.length) return null;
  const slots = [0, 1, 2, 3].map((i) => four[i] ?? null);

  return (
    <ProfileSection
      id="four"
      title={isOwner ? "Your four" : `${username}'s four`}
      description={
        isOwner
          ? "Four titles that stand for you. They're the first thing people see here."
          : `The four titles ${username} chose to stand for them.`
      }
      action={isOwner ? <EditTasteInFour currentItems={four} profileId={userId} handle={editor} /> : null}
    >
      <ol className="grid max-w-read grid-cols-4 gap-3 sm:gap-5">
        {slots.map((it, i) =>
          it ? (
            <li key={`${it.item_type}:${it.item_id}`} className="min-w-0">
              <Link href={titlePath(it.item_type, it.item_id, it.item_name)} className="group block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getPosterUrl(it.image_url, "w342")}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="img-fade aspect-2/3 w-full rounded-media bg-hover object-cover shadow-lg ring-1 ring-inset ring-line-strong transition-opacity group-hover:opacity-90"
                />
                <span className="mt-2 block truncate font-display text-sm text-ink-0 sm:text-base">{it.item_name}</span>
              </Link>
            </li>
          ) : isOwner ? (
            <li key={`empty-${i}`} className="min-w-0">
              <button
                type="button"
                onClick={() => editor.current?.open(i)}
                className="flex aspect-2/3 w-full flex-col items-center justify-center gap-1.5 rounded-media border-2 border-dashed border-line-input text-ink-500 transition-colors hover:border-ink-400 hover:text-ink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <Plus className="size-5" aria-hidden />
                <span className="text-xs font-medium sm:text-sm">Choose</span>
              </button>
              <span className="mt-2 block text-sm text-transparent" aria-hidden>
                ·
              </span>
            </li>
          ) : null,
        )}
      </ol>
    </ProfileSection>
  );
}

/* ── Favourites ───────────────────────────────────────────────────────────── */

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
  const router = useRouter();
  const visitor = !!viewerId && !isOwner;
  // Keyed on the viewer too: what RLS returns depends on who is asking.
  const { data: favourites, error, mutate } = useSWR(["favourites", userId, viewerId], () => fetchFavourites(userId), { revalidateOnFocus: false });
  const { data: mine } = useSWR(visitor ? ["favourite-keys", viewerId] : null, () => fetchFavouriteKeys(viewerId!), { revalidateOnFocus: false });
  const { togglePreference } = useContext(UserPrefrenceContext);
  const { refresh } = useMediaInteraction();
  const [kind, setKind] = useState<"all" | "movie" | "tv">("all");
  const [open, setOpen] = useState(false);
  const [managing, setManaging] = useState(false);

  const all = useMemo(() => favourites ?? [], [favourites]);
  const films = all.filter((f) => f.itemType === "movie").length;
  const series = all.length - films;
  const leans = useMemo(() => (all.length >= ENOUGH ? topGenres(all) : []), [all]);
  const shared = useMemo(() => (mine ? sharedFavourites(all, mine) : []), [all, mine]);
  const sharedKeys = useMemo(() => new Set(shared.map(favKey)), [shared]);
  const inFour = useMemo(() => new Set(four.map((f) => `${f.item_type}:${f.item_id}`)), [four]);
  const filtered = all.filter((f) => kind === "all" || f.itemType === kind);
  const shown = open || managing ? filtered : filtered.slice(0, FIRST);

  if (!isOwner && (error || (favourites && !all.length))) return null;

  /** Out of favourites, from here: optimistic, with the four refreshed if it was one of them. */
  const remove = async (f: Favourite) => {
    const key = favKey(f);
    void mutate((cur) => (cur ?? []).filter((x) => favKey(x) !== key), { revalidate: false });
    const result = await togglePreference({
      funcType: "favorite",
      itemId: Number(f.itemId),
      name: f.itemName,
      mediaType: f.itemType,
      imgUrl: f.imageUrl ?? undefined,
      adult: false,
      genres: f.genres,
      currentState: true,
    }).catch(() => ({ ok: false, message: "That didn't save. Check your connection." }));
    if (!result.ok) {
      toast.error(result.message ?? "That didn't save. Check your connection.");
      void mutate();
      return;
    }
    void refresh();
    // Leaving favourites also leaves the four (the route clears it there).
    if (inFour.has(key)) router.refresh();
  };

  const counts = [films ? `${films} ${films === 1 ? "film" : "films"}` : null, series ? `${series} series` : null].filter(Boolean).join(", ");
  const description = all.length
    ? `${isOwner ? "Everything you've hearted" : `Everything ${username} has hearted`}: ${counts}${leans.length ? `, mostly ${listWords(leans)}` : ""}.`
    : isOwner
      ? "Heart a film or series on its page and it joins this list."
      : null;

  return (
    <ProfileSection
      id="favourites"
      title="Favourites"
      count={all.length}
      description={description}
      action={
        isOwner && all.length > 0 ? (
          <button type="button" aria-pressed={managing} onClick={() => setManaging((m) => !m)} className={sectionAction}>
            {managing ? "Done" : "Manage"}
          </button>
        ) : null
      }
    >
      {shared.length > 0 && (
        <p className="mb-4 flex items-start gap-2 text-sm leading-relaxed text-ink-300">
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

      {managing && <p className="mb-4 text-sm text-ink-400">Tap the heart on a poster to take it out of your favourites.</p>}

      {!favourites && !error ? (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-8" aria-hidden>
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="aspect-2/3 rounded-media bg-raised" />
          ))}
        </ul>
      ) : all.length > 0 ? (
        <>
          {films > 0 && series > 0 && all.length >= ENOUGH && (
            <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Show">
              {(["all", "movie", "tv"] as const).map((k) => (
                <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={chip(kind === k)}>
                  {k === "all" ? "All" : k === "movie" ? `Films ${films}` : `Series ${series}`}
                </button>
              ))}
            </div>
          )}
          <ul
            className={`grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 lg:grid-cols-8 ${open || managing ? "" : "max-sm:[&>li:nth-child(n+7)]:hidden"}`}
          >
            {shown.map((f) => (
              <Poster key={favKey(f)} favourite={f} shared={sharedKeys.has(favKey(f))} managing={managing} onRemove={() => void remove(f)} />
            ))}
          </ul>
          {!managing && filtered.length > FIRST && (
            <button type="button" onClick={() => setOpen((o) => !o)} className={`${sectionAction} mt-5`}>
              {open ? "Show fewer" : `See all ${filtered.length}`}
              {!open && <ArrowRight className="size-4" aria-hidden />}
            </button>
          )}
        </>
      ) : null}
    </ProfileSection>
  );
}

function Poster({ favourite: f, shared, managing, onRemove }: { favourite: Favourite; shared: boolean; managing: boolean; onRemove: () => void }) {
  return (
    <li className="relative min-w-0">
      <Link href={titlePath(f.itemType, f.itemId, f.itemName)} className="group block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={getPosterUrl(f.imageUrl, "w185")}
          alt=""
          loading="lazy"
          decoding="async"
          className={`aspect-2/3 w-full rounded-media bg-hover object-cover transition-opacity group-hover:opacity-90 ${shared ? "ring-2 ring-accent" : "ring-1 ring-inset ring-line-strong"} ${managing ? "opacity-80" : ""}`}
        />
        <span className="mt-1.5 block truncate text-xs text-ink-400 group-hover:text-ink-0">{f.itemName}</span>
      </Link>
      {shared && !managing && (
        <span className="pointer-events-none absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-page/85">
          <Heart className="size-3.5 fill-accent text-accent" aria-hidden />
          <span className="sr-only">You love it too</span>
        </span>
      )}
      {managing && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Take ${f.itemName} out of your favourites`}
          className="absolute right-1.5 top-1.5 flex size-9 items-center justify-center rounded-full bg-page/90 text-danger shadow ring-1 ring-inset ring-line-strong transition-colors hover:bg-danger/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <HeartOff className="size-4" aria-hidden />
        </button>
      )}
    </li>
  );
}
