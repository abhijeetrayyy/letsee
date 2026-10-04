"use client";

import { useState, useCallback, useEffect, useRef } from "react";
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

export default function EditTasteInFour({
  currentItems,
  profileId,
}: {
  currentItems: DisplayItem[];
  profileId: string;
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
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = before;
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
  const [pickerTab, setPickerTab] = useState<"watched" | "favorites">("watched");
  const [saving, setSaving] = useState(false);
  const [watched, setWatched] = useState<PickableItem[]>([]);
  const [favorites, setFavorites] = useState<PickableItem[]>([]);
  const [loaded, setLoaded] = useState(false);
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

  const loadPickable = useCallback(async () => {
    if (loaded) return;
    setLoaded(true);
    try {
      // This picker only ever opens on your own profile, so the viewer and the
      // owner are the same person — but it is passed explicitly rather than
      // assumed, because `fetchWatchedPage` decides whether to include the
      // private diary column on exactly that comparison.
      const [wData, fData] = await Promise.all([
        fetchWatchedPage(profileId, profileId, 1),
        fetchFavoritesPage(profileId, profileId, 1, 100),
      ]);
      setWatched((wData.data ?? []).map((d: any) => ({
        item_id: String(d.item_id),
        item_name: d.item_name ?? "",
        item_type: d.item_type ?? "movie",
        image_url: d.image_url,
      })));
      setFavorites((fData.data ?? []).map((d: any) => ({
        item_id: String(d.item_id),
        item_name: d.item_name ?? "",
        item_type: d.item_type ?? "movie",
        image_url: d.image_url,
      })));
    } catch {
      setLoaded(false);
    }
  }, [profileId, loaded]);

  const openModal = () => {
    const arr: (PickableItem | null)[] = [null, null, null, null];
    currentItems.forEach((it, i) => {
      if (i < 4) arr[i] = { item_id: it.item_id, item_name: it.item_name, item_type: it.item_type, image_url: it.image_url };
    });
    setSlots(arr);
    setSelectedSlot(null);
    setPickerTab("watched");
    setOpen(true);
    loadPickable();
  };

  const assignToSlot = useCallback((item: PickableItem, slotIndex: number) => {
    setSlots((prev) => prev.map((it, i) =>
      i === slotIndex ? item : (it && it.item_id === item.item_id && it.item_type === item.item_type ? null : it)
    ));
    setSelectedSlot(null);
  }, []);

  const addToFirstEmpty = useCallback((item: PickableItem) => {
    setSlots((prev) => {
      const idx = prev.findIndex((s) => !s);
      if (idx < 0) return prev;
      return prev.map((it, i) =>
        i === idx ? item : (it && it.item_id === item.item_id && it.item_type === item.item_type ? null : it)
      );
    });
  }, []);

  const handlePickItem = (item: PickableItem) => {
    if (selectedSlot !== null) assignToSlot(item, selectedSlot);
    else addToFirstEmpty(item);
  };

  const clearSlot = (idx: number) => {
    setSlots((prev) => prev.map((it, i) => (i === idx ? null : it)));
    if (selectedSlot === idx) setSelectedSlot(null);
  };

  const save = async () => {
    const toSave = slots.filter((s): s is PickableItem => !!s);
    setSaving(true);
    try {
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
        alert(err?.error || "Failed to save");
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

  /** A title from search has to become a favourite before it can be displayed. */
  const pickRemote = async (it: PickableItem) => {
    await fetch("/api/favoriteButton", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemId: it.item_id,
        name: it.item_name,
        mediaType: it.item_type,
        imgUrl: it.image_url ? getPosterUrl(it.image_url) : null,
        genres: [],
      }),
    }).catch(() => {});
    setFavorites((cur) => (cur.some((f) => f.item_id === it.item_id && f.item_type === it.item_type) ? cur : [it, ...cur]));
    handlePickItem(it);
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
              <p className="text-ink-400 text-sm mt-1">
                Tap a slot to select it, then pick a title below. Or tap a title to add to the next empty slot.
              </p>
            </div>

            {/* Single scrollable area: Your 4 + Choose from — Cancel/Save stay fixed below */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              {/* Your 4 */}
              <div className="p-5 border-b border-line-strong">
                <p className="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-3">Your 4</p>
                <div className="grid grid-cols-4 gap-3">
                  {[0, 1, 2, 3].map((idx) => {
                    const it = slots[idx];
                    const isSelected = selectedSlot === idx;
                    return (
                      <div
                        key={idx}
                        className="flex flex-col items-center"
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedSlot(isSelected ? null : idx)}
                          className={`relative w-full aspect-2/3 rounded-xl overflow-hidden border-2 transition-all ${
                            isSelected
                              ? "border-line-input ring-2 ring-focus/50"
                              : it
                                ? "border-line-input hover:border-line-bold"
                                : "border-dashed border-line-input bg-overlay/50 hover:border-line-bold"
                          }`}
                        >
                          {it ? (
                            <>
                              <img loading="lazy" decoding="async"
                                src={getPosterUrl(it.image_url)}
                                alt={it.item_name}
                                className="w-full h-full object-cover"
                              />
                              <span className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 active:opacity-100 transition-opacity touch-manipulation" aria-hidden />
                            </>
                          ) : (
                            <span className="flex items-center justify-center h-full text-ink-500 text-3xl font-light">+</span>
                          )}
                        </button>
                        <p className="text-xs font-medium text-ink-400 mt-1.5 w-full truncate text-center">
                          {it ? it.item_name : `Slot ${idx + 1}`}
                        </p>
                        {it && (
                          <div className="mt-0.5 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); void loadPosters(idx); }}
                              className="text-xs text-ink-400 hover:text-ink-0"
                            >
                              Poster
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); clearSlot(idx); }}
                              className="text-xs text-danger hover:text-danger"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
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
                    onClick={() => setPickerTab("watched")}
                    className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      pickerTab === "watched"
                        ? "bg-action text-on-action"
                        : "bg-overlay text-ink-400 hover:text-ink-0"
                    }`}
                  >
                    Watched ({watched.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPickerTab("favorites")}
                    className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      pickerTab === "favorites"
                        ? "bg-action text-on-action"
                        : "bg-overlay text-ink-400 hover:text-ink-0"
                    }`}
                  >
                    Favorites ({favorites.length})
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
                  {!loaded ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-3">
                      <LoadingSpinner size="md" className="border-t-white shrink-0" />
                      <p className="text-ink-500 text-sm animate-pulse">Loading…</p>
                    </div>
                  ) : pickerList.length === 0 ? (
                    <p className="text-ink-500 text-sm py-12 text-center">
                      {pickerTab === "watched" ? "No watched titles yet." : "No favorites yet."}
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {pickerList.map((it) => (
                        <button
                          key={`${it.item_type}-${it.item_id}`}
                          type="button"
                          onClick={() => handlePickItem(it)}
                          className="text-left rounded-xl overflow-hidden border-2 border-line-input bg-overlay hover:border-ink-0/60 hover:bg-hover transition-all group"
                        >
                          <div className="aspect-2/3 bg-hover overflow-hidden">
                            <img loading="lazy" decoding="async"
                              src={getPosterUrl(it.image_url)}
                              alt={it.item_name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            />
                          </div>
                          <p className="p-3 text-sm font-medium text-ink-0 truncate" title={it.item_name}>
                            {it.item_name}
                          </p>
                        </button>
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
                          <button
                            key={`r-${it.item_type}-${it.item_id}`}
                            type="button"
                            onClick={() => void pickRemote(it)}
                            className="text-left rounded-xl overflow-hidden border-2 border-line-input bg-overlay hover:border-ink-0/60 hover:bg-hover transition-all group"
                          >
                            <div className="aspect-2/3 bg-hover overflow-hidden">
                              <img loading="lazy" decoding="async"
                                src={getPosterUrl(it.image_url)}
                                alt={it.item_name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              />
                            </div>
                            <p className="p-3 text-sm font-medium text-ink-0 truncate" title={it.item_name}>
                              {it.item_name}
                            </p>
                          </button>
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
