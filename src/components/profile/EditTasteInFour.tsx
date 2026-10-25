"use client";

import { useState, useEffect, useImperativeHandle, useRef } from "react";
import toast from "react-hot-toast";
import { X } from "lucide-react";
import { lockScroll } from "@/lib/ui/scrollLock";
import { useRouter } from "next/navigation";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { getPosterUrl } from "@/utils/imageUrl";
import { fetchFavoritesPage, fetchWatchedPage } from "@/lib/db/profileGrid";

type DisplayItem = {
  position: number;
  item_id: string;
  item_type: string;
  image_url: string | null;
  item_name: string;
};

type PickableItem = {
  item_id: string;
  item_name: string;
  item_type: string;
  image_url?: string | null;
};

/** Lets the profile's empty slots open the editor at that slot. */
export type FourEditorHandle = { open: (slot?: number) => void };

export default function EditTasteInFour({
  currentItems,
  profileId,
  handle,
}: {
  currentItems: DisplayItem[];
  profileId: string;
  handle?: React.Ref<FourEditorHandle>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);

  // A dialog: Escape closes it, focus goes in when it opens and back to the
  // button when it shuts, and the page behind doesn't scroll.
  useEffect(() => {
    if (!open) return;
    const back = trigger.current;
    const unlock = lockScroll();
    dialog.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      unlock();
      window.removeEventListener("keydown", onKey);
      back?.focus();
    };
  }, [open]);
  const [slots, setSlots] = useState<(PickableItem | null)[]>(() => {
    const arr: (PickableItem | null)[] = [null, null, null, null];
    currentItems.forEach((it, i) => {
      if (i < 4) arr[i] = { item_id: it.item_id, item_name: it.item_name, item_type: it.item_type, image_url: it.image_url };
    });
    return arr;
  });
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  // Favourites first: the four are usually chosen from what you've hearted.
  const [pickerTab, setPickerTab] = useState<"watched" | "favorites">("favorites");
  const [saving, setSaving] = useState(false);
  const [watched, setWatched] = useState<PickableItem[]>([]);
  const [favorites, setFavorites] = useState<PickableItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  /** `loaded` flips when the read starts (so it runs once); this is whether it has come back. */
  const [fetching, setFetching] = useState(false);
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState<PickableItem[]>([]);
  const [searching, setSearching] = useState(false);
  /**
   * Alternate posters for the selected slot. Letterboxd charges its Patron
   * tier for this; the images are public TMDB data and the choice is the
   * identity act, so here it is a button. Stored as the resolved URL, the
   * shape `image_url` already holds.
   */
  const [posters, setPosters] = useState<{ path: string; language: string | null }[] | null>(null);
  const [postersFor, setPostersFor] = useState<number | null>(null);
  const [postersLoading, setPostersLoading] = useState(false);

  const loadPosters = async (slotIndex: number) => {
    const it = slots[slotIndex];
    if (!it) return;
    setPostersFor(slotIndex);
    setPostersLoading(true);
    try {
      const res = await fetch(`/api/title-images?type=${it.item_type === "tv" ? "tv" : "movie"}&id=${encodeURIComponent(it.item_id)}`);
      const body = res.ok ? await res.json() : null;
      setPosters((body?.posters ?? body?.data?.posters ?? []) as { path: string; language: string | null }[]);
    } catch {
      setPosters([]);
    } finally {
      setPostersLoading(false);
    }
  };

  const choosePoster = (slotIndex: number, path: string) => {
    setSlots((prev) => prev.map((it, i) => (i === slotIndex && it ? { ...it, image_url: getPosterUrl(path, "w342") } : it)));
    setPosters(null);
    setPostersFor(null);
  };

  /** Which list couldn't be read, so it can say so and offer to try again. */
  const [failed, setFailed] = useState<{ watched: boolean; favorites: boolean }>({ watched: false, favorites: false });

  const loadPickable = async (again = false) => {
    if (loaded && !again) return;
    setLoaded(true);
    setFetching(true);
    // This picker only ever opens on your own profile, so the viewer and the
    // owner are the same person — but it is passed explicitly rather than
    // assumed, because `fetchWatchedPage` decides whether to include the
    // private diary column on exactly that comparison. Each list stands on
    // its own: one that fails doesn't hide the other.
    const toPickable = (rows: any[] | null | undefined): PickableItem[] =>
      (rows ?? []).map((d: any) => ({ item_id: String(d.item_id), item_name: d.item_name ?? "", item_type: d.item_type ?? "movie", image_url: d.image_url }));
    const [w, f] = await Promise.allSettled([fetchWatchedPage(profileId, profileId, 1), fetchFavoritesPage(profileId, profileId, 1, 100)]);
    if (w.status === "fulfilled") setWatched(toPickable(w.value.data));
    if (f.status === "fulfilled") setFavorites(toPickable(f.value.data));
    setFailed({ watched: w.status === "rejected", favorites: f.status === "rejected" });
    setFetching(false);
  };

  const openModal = () => {
    const arr: (PickableItem | null)[] = [null, null, null, null];
    currentItems.forEach((it, i) => {
      if (i < 4) arr[i] = { item_id: it.item_id, item_name: it.item_name, item_type: it.item_type, image_url: it.image_url };
    });
    setSlots(arr);
    setSelectedSlot(null);
    setPlaced(null);
    setSaid("");
    setPosters(null);
    setPostersFor(null);
    setPickerTab("favorites");
    setOpen(true);
    void loadPickable();
  };

  useImperativeHandle(handle, () => ({
    open: (slot?: number) => {
      openModal();
      if (typeof slot === "number") setSelectedSlot(slot);
    },
  }));

  /** A slot that just took a film, lit for a moment so you see where it went. */
  const [placed, setPlaced] = useState<number | null>(null);
  /** Said to screen readers: where a pick went, or that it came out. */
  const [said, setSaid] = useState("");
  useEffect(() => {
    if (placed === null) return;
    const t = setTimeout(() => setPlaced(null), 1600);
    return () => clearTimeout(t);
  }, [placed]);

  const same = (a: PickableItem | null, b: PickableItem) => !!a && a.item_id === b.item_id && a.item_type === b.item_type;
  const slotOf = (item: PickableItem) => slots.findIndex((s) => same(s, item));
  // Where the next tap goes: the slot you chose, else the first empty one. Null when all four are full.
  const firstEmpty = slots.findIndex((s) => !s);
  const target = selectedSlot ?? (firstEmpty >= 0 ? firstEmpty : null);

  /**
   * A tap on a film. In your four already: out it comes — or, with another
   * slot chosen, the two swap places. Otherwise it goes where `target` says,
   * and that slot lights up. All four full and none chosen: say how to change one.
   */
  const handlePickItem = (item: PickableItem): boolean => {
    const at = slotOf(item);
    if (at >= 0 && (selectedSlot === null || selectedSlot === at)) {
      setSlots((prev) => prev.map((it, i) => (i === at ? null : it)));
      setSelectedSlot(null);
      setSaid(`${item.item_name} is out of your four.`);
      return false;
    }
    if (target === null) {
      toast("Your four are full — tap one of them to swap it, or × to take it out.", { id: "four-full" });
      return false;
    }
    setSlots((prev) => prev.map((it, i) => (i === target ? item : i === at ? prev[target] : it)));
    setSelectedSlot(null);
    setPlaced(target);
    setSaid(`${item.item_name} is number ${target + 1} of your four.`);
    return true;
  };

  const clearSlot = (idx: number) => {
    const it = slots[idx];
    setSlots((prev) => prev.map((x, i) => (i === idx ? null : x)));
    if (selectedSlot === idx) setSelectedSlot(null);
    if (postersFor === idx) {
      setPosters(null);
      setPostersFor(null);
    }
    if (it) setSaid(`${it.item_name} is out of your four.`);
  };

  const save = async () => {
    const toSave = slots.filter((s): s is PickableItem => !!s);
    setSaving(true);
    try {
      // Anything picked from search is a favourite before it's displayed.
      await Promise.all(favouriting.current);
      favouriting.current = [];
      const res = await fetch("/api/profile/favorite-display", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: toSave.map((it) => ({
            item_id: it.item_id,
            item_type: it.item_type,
            item_name: it.item_name,
            image_url: it.image_url ?? null,
          })),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.error || "Your four didn't save. Try again.");
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const q = query.trim().toLowerCase();
  const source = pickerTab === "watched" ? watched : favorites;
  const pickerList = q ? source.filter((it) => it.item_name.toLowerCase().includes(q)) : source;

  /**
   * Search reaches past the lists, not just within them.
   *
   * There was no search here at all — you could only scroll whatever the first
   * page of your watched and favourites happened to contain, so changing a pick
   * to something further down the list, or to something not in it yet, was
   * impossible. Onboarding asks the same question with a search box over all of
   * TMDB; this is the screen where you change that answer and it offered less.
   *
   * A title picked from TMDB goes through /api/favoriteButton, which makes it a
   * favourite and therefore watched — so the invariant this display depends on
   * (taste-of-four is a subset of favourites, which is a subset of watched)
   * holds by construction rather than by hoping the picker only offered legal
   * options.
   */
  useEffect(() => {
    if (q.length < 2) {
      setRemote([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(() => {
      fetch(`/api/search?query=${encodeURIComponent(q)}&media_type=multi`)
        .then((r) => (r.ok ? r.json() : null))
        .then((body) => {
          if (cancelled) return;
          const rows = (body?.results ?? body?.data?.results ?? []) as any[];
          setRemote(
            rows
              .filter((r) => (r.media_type === "movie" || r.media_type === "tv") && (r.title || r.name))
              .slice(0, 12)
              .map((r) => ({
                item_id: String(r.id),
                item_name: r.title ?? r.name ?? "",
                item_type: r.media_type as "movie" | "tv",
                // Store the resolved URL, matching what favorite_items and
                // watched_items hold — one shape in the database beats every
                // reader having to guess which it got.
                image_url: r.poster_path ? getPosterUrl(r.poster_path, "w342") : null,
              })),
          );
        })
        .catch(() => !cancelled && setRemote([]))
        .finally(() => !cancelled && setSearching(false));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  /**
   * A title from search has to become a favourite before it can be displayed.
   * It goes into your four at once — the tap answers straight away — and the
   * favourite is saved behind it; Save waits for that before it writes.
   */
  const favouriting = useRef<Promise<unknown>[]>([]);
  const pickRemote = (it: PickableItem) => {
    if (!handlePickItem(it)) return;
    setFavorites((cur) => (cur.some((f) => f.item_id === it.item_id && f.item_type === it.item_type) ? cur : [it, ...cur]));
    favouriting.current.push(
      fetch("/api/favoriteButton", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: it.item_id,
          name: it.item_name,
          mediaType: it.item_type,
          imgUrl: it.image_url ? getPosterUrl(it.image_url) : null,
          genres: [],
          // Favourite it, never un-favourite: the route toggles. And seen, but
          // not today — a film you love isn't one you watched this evening.
          add: true,
          dated: false,
        }),
      }).catch(() => {}),
    );
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={openModal}
        className="inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-sm font-medium text-ink-200 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover hover:text-ink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        {currentItems.length ? "Edit your four" : "Choose your four"}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-page/80 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-four-title"
            tabIndex={-1}
            className="bg-raised rounded-2xl border border-line-strong shadow-2xl w-full max-w-read max-h-[90vh] overflow-hidden flex flex-col focus:outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header — fixed, never shrinks */}
            <div className="shrink-0 p-5 border-b border-line-strong">
              <h2 id="edit-four-title" className="text-xl font-medium text-ink-0">Your four</h2>
              <p className="text-ink-400 text-sm mt-1">The four films that say the most about you — the first thing people see on your profile.</p>
            </div>

            {/* One scrolling area; the four stay pinned at its top, so every pick lands where you can see it. */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="sticky top-0 z-10 border-b border-line-strong bg-raised px-5 pb-4 pt-4">
                <ol className="mx-auto grid max-w-80 grid-cols-4 gap-3" aria-label="Your four, in order">
                  {[0, 1, 2, 3].map((idx) => {
                    const it = slots[idx];
                    const isTarget = target === idx;
                    const lit = isTarget || placed === idx;
                    return (
                      <li key={idx} className="relative min-w-0">
                        <button
                          type="button"
                          onClick={() => setSelectedSlot(selectedSlot === idx ? null : idx)}
                          aria-pressed={selectedSlot === idx}
                          aria-label={it ? `Number ${idx + 1}: ${it.item_name}. ${selectedSlot === idx ? "Chosen — the next film you tap goes here." : "Choose this slot to change it."}` : `Number ${idx + 1}: empty.${isTarget ? " The next film you tap goes here." : ""}`}
                          className={`relative block w-full aspect-2/3 overflow-hidden rounded-media transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                            lit ? "ring-2 ring-action ring-offset-2 ring-offset-raised" : it ? "ring-1 ring-inset ring-line-strong" : ""
                          } ${it ? "" : isTarget ? "bg-action/10" : "border border-dashed border-line-input bg-page/40"}`}
                        >
                          {it ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img loading="lazy" decoding="async" src={getPosterUrl(it.image_url)} alt="" className={`h-full w-full object-cover transition-opacity ${selectedSlot !== null && selectedSlot !== idx ? "opacity-60" : ""}`} />
                          ) : (
                            <span className={`flex h-full items-center justify-center text-xs font-medium ${isTarget ? "text-ink-0" : "text-ink-500"}`}>{isTarget ? "Next" : "Empty"}</span>
                          )}
                          <span
                            aria-hidden
                            className={`absolute left-1.5 top-1.5 flex size-6 items-center justify-center rounded-full font-mono text-xs font-semibold ${lit ? "bg-action text-on-action" : "bg-page/85 text-ink-0"}`}
                          >
                            {idx + 1}
                          </span>
                        </button>
                        {it && (
                          <button
                            type="button"
                            onClick={() => clearSlot(idx)}
                            aria-label={`Take ${it.item_name} out of your four`}
                            className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-page/85 text-ink-200 ring-1 ring-inset ring-line-input transition-colors hover:text-ink-0"
                          >
                            <X className="size-3.5" aria-hidden />
                          </button>
                        )}
                        <p className="mt-1.5 truncate text-center text-xs text-ink-400">{it ? it.item_name : "\u00a0"}</p>
                      </li>
                    );
                  })}
                </ol>

                {/* Where the next tap goes, always in words. */}
                <div className="mt-3 flex min-h-8 flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-center text-sm text-ink-300" aria-live="polite">
                  {selectedSlot !== null && slots[selectedSlot] ? (
                    <>
                      <span className="min-w-0">
                        Tap a film to put it at <span className="font-semibold text-ink-0">{selectedSlot + 1}</span> instead of {slots[selectedSlot]!.item_name}.
                      </span>
                      <button
                        type="button"
                        onClick={() => void loadPosters(selectedSlot)}
                        className="h-8 rounded-full px-3 text-xs font-medium text-ink-200 ring-1 ring-inset ring-line-input hover:bg-hover hover:text-ink-0"
                      >
                        Choose its poster
                      </button>
                    </>
                  ) : target !== null ? (
                    <span>
                      Tap a film to put it at <span className="font-semibold text-ink-0">{target + 1}</span>.{selectedSlot === null && slots.some(Boolean) ? " Tap one of your four to change it." : ""}
                    </span>
                  ) : (
                    <span>All four chosen. Tap one to change it or choose its poster, or × to take it out.</span>
                  )}
                </div>
                <p className="sr-only" aria-live="assertive">
                  {said}
                </p>
              </div>

              {postersFor !== null && (
                <div className="p-5 border-b border-line-strong">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-semibold text-ink-500 uppercase tracking-wider">
                      Posters for {slots[postersFor]?.item_name}
                    </p>
                    <button type="button" onClick={() => { setPosters(null); setPostersFor(null); }} className="text-xs text-ink-500 hover:text-ink-0">
                      Close
                    </button>
                  </div>
                  {postersLoading ? (
                    <LoadingSpinner size="sm" />
                  ) : posters && posters.length > 0 ? (
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                      {posters.map((p) => (
                        <button
                          key={p.path}
                          type="button"
                          onClick={() => choosePoster(postersFor, p.path)}
                          className="relative aspect-2/3 overflow-hidden rounded-lg border-2 border-line-strong hover:border-line-input"
                          title={p.language ? `Poster (${p.language})` : "Textless poster"}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={getPosterUrl(p.path, "w185")} alt="" loading="lazy" className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-ink-500">Only the one poster for this title.</p>
                  )}
                </div>
              )}

              {/* Choose from — tabs + cards (all scroll together with Your 4) */}
              <div className="p-5">
                <p className="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-3">Choose from</p>
                <div className="flex gap-2 mb-4">
                  <button
                    type="button"
                    onClick={() => setPickerTab("favorites")}
                    className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      pickerTab === "favorites"
                        ? "bg-action text-on-action"
                        : "bg-overlay text-ink-400 hover:text-ink-0"
                    }`}
                  >
                    Favourites
                  </button>
                  <button
                    type="button"
                    onClick={() => setPickerTab("watched")}
                    className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      pickerTab === "watched"
                        ? "bg-action text-on-action"
                        : "bg-overlay text-ink-400 hover:text-ink-0"
                    }`}
                  >
                    Watched
                  </button>
                </div>
                {/* The search that was missing entirely. Without it you could
                    only scroll the first page of your lists, so swapping a pick
                    for anything further down — or for something not in your
                    lists yet — was impossible. */}
                <div className="mb-3">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search your list, or anything on TMDB"
                    aria-label="Search titles"
                    className="w-full rounded-xl border border-line-strong bg-page px-4 py-2.5 text-sm text-ink-0 placeholder-ink-500 focus:border-line-input focus:outline-none"
                  />
                </div>

                <div className="rounded-xl border border-line-strong bg-overlay/50 p-4">
                  {!loaded || fetching ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-3">
                      <LoadingSpinner size="md" className="border-t-white shrink-0" />
                      <p className="text-ink-500 text-sm animate-pulse">Loading…</p>
                    </div>
                  ) : failed[pickerTab] ? (
                    <div className="py-10 text-center">
                      <p className="text-sm text-ink-400">Couldn&apos;t load your {pickerTab === "watched" ? "watched films" : "favourites"}. You can still search for any film above.</p>
                      <button
                        type="button"
                        onClick={() => void loadPickable(true)}
                        className="mt-3 h-9 rounded-full px-4 text-sm font-medium text-ink-0 ring-1 ring-inset ring-line-input hover:bg-hover"
                      >
                        Try again
                      </button>
                    </div>
                  ) : pickerList.length === 0 ? (
                    <p className="text-ink-500 text-sm py-12 text-center">
                      {pickerTab === "watched" ? "No watched titles yet." : "No favourites yet. Heart a title on its page."}
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {pickerList.map((it) => (
                        <Tile key={`${it.item_type}-${it.item_id}`} item={it} slot={slotOf(it)} onPick={() => handlePickItem(it)} />
                      ))}
                    </div>
                  )}

                  {/* Anything not in your lists yet. Picking one favourites it,
                      which marks it watched — so it is legal to display before
                      it ever appears above. */}
                  {q.length >= 2 && remote.length > 0 && (
                    <div className="mt-5 border-t border-line-strong/70 pt-4">
                      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-ink-500">
                        {searching ? "Searching…" : "Not in your list yet"}
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {remote.map((it) => (
                          <Tile key={`r-${it.item_type}-${it.item_id}`} item={it} slot={slotOf(it)} onPick={() => pickRemote(it)} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer — fixed at bottom, always visible */}
            <div className="shrink-0 p-5 border-t border-line-strong bg-raised flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-ink-300 hover:bg-overlay focus:outline-none focus:ring-2 focus:ring-line-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                aria-busy={saving}
                className="px-5 py-2.5 rounded-xl text-sm font-medium bg-action text-on-action hover:bg-action-hover disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-focus flex items-center justify-center gap-2 min-w-22 transition-all duration-200 active:scale-[0.98]"
              >
                {saving ? (
                  <>
                    <LoadingSpinner size="sm" className="border-t-amber-900 shrink-0" />
                    <span>Saving…</span>
                  </>
                ) : (
                  "Save"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * A film to choose. In your four, it says so where you look — its number on
 * the poster, ringed — and a second tap takes it out.
 */
function Tile({ item, slot, onPick }: { item: PickableItem; slot: number; onPick: () => void }) {
  const chosen = slot >= 0;
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={chosen}
      aria-label={chosen ? `${item.item_name} — number ${slot + 1} of your four. Tap to take it out.` : item.item_name}
      className={`group text-left rounded-xl overflow-hidden bg-overlay transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
        chosen ? "ring-2 ring-action" : "ring-1 ring-inset ring-line-input hover:ring-line-bold"
      }`}
    >
      <div className="relative aspect-2/3 bg-hover overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img loading="lazy" decoding="async" src={getPosterUrl(item.image_url ?? null)} alt="" className={`h-full w-full object-cover transition-opacity ${chosen ? "opacity-70" : "group-hover:opacity-90"}`} />
        {chosen && (
          <span aria-hidden className="absolute left-2 top-2 flex size-8 items-center justify-center rounded-full bg-action font-mono text-sm font-semibold text-on-action">
            {slot + 1}
          </span>
        )}
      </div>
      <p className={`px-3 pt-2.5 text-sm font-medium truncate ${chosen ? "text-ink-0" : "text-ink-200"}`} title={item.item_name}>
        {item.item_name}
      </p>
      <p className="px-3 pb-2.5 text-xs text-ink-500">{chosen ? `In your four · ${slot + 1}` : "\u00a0"}</p>
    </button>
  );
}
