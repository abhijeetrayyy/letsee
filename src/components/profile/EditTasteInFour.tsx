"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

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

const NO_POSTER = "/no-photo.webp";
const TMDB_POSTER_BASE = "https://image.tmdb.org/t/p/w185";

function getPosterUrl(url: string | null | undefined): string {
  if (!url?.trim()) return NO_POSTER;
  const u = url.trim();
  if (u.startsWith("http")) return u;
  const path = u.startsWith("/") ? u.slice(1) : u;
  return `${TMDB_POSTER_BASE}/${path}`;
}

export default function EditTasteInFour({
  currentItems,
  profileId,
}: {
  currentItems: DisplayItem[];
  profileId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
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

  const loadPickable = useCallback(async () => {
    if (loaded) return;
    setLoaded(true);
    try {
      const [watchedRes, favRes] = await Promise.all([
        fetch("/api/UserWatchedPagination", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userID: profileId, page: 1 }),
        }),
        fetch("/api/UserFavoritePagination", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userID: profileId, page: 1, limit: 100 }),
        }),
      ]);
      const wData = watchedRes.ok ? await watchedRes.json() : { data: [] };
      const fData = favRes.ok ? await favRes.json() : { data: [] };
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

  const pickerList = pickerTab === "watched" ? watched : favorites;

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="text-sm font-medium text-amber-400 hover:text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500/50 rounded px-1"
      >
        Edit Taste in 4
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-neutral-900 rounded-2xl border border-neutral-700 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header — fixed, never shrinks */}
            <div className="shrink-0 p-5 border-b border-neutral-700">
              <h2 className="text-xl font-bold text-white">Edit Taste in 4</h2>
              <p className="text-neutral-400 text-sm mt-1">
                Tap a slot to select it, then pick a title below. Or tap a title to add to the next empty slot.
              </p>
            </div>

            {/* Single scrollable area: Your 4 + Choose from — Cancel/Save stay fixed below */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              {/* Your 4 */}
              <div className="p-5 border-b border-neutral-700">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Your 4</p>
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
                              ? "border-amber-500 ring-2 ring-amber-500/50"
                              : it
                                ? "border-neutral-600 hover:border-neutral-500"
                                : "border-dashed border-neutral-600 bg-neutral-800/50 hover:border-neutral-500"
                          }`}
                        >
                          {it ? (
                            <>
                              <img
                                src={getPosterUrl(it.image_url)}
                                alt={it.item_name}
                                className="w-full h-full object-cover"
                              />
                              <span className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity" />
                            </>
                          ) : (
                            <span className="flex items-center justify-center h-full text-neutral-500 text-3xl font-light">+</span>
                          )}
                        </button>
                        <p className="text-xs font-medium text-neutral-400 mt-1.5 w-full truncate text-center">
                          {it ? it.item_name : `Slot ${idx + 1}`}
                        </p>
                        {it && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); clearSlot(idx); }}
                            className="text-xs text-red-400 hover:text-red-300 mt-0.5"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Choose from — tabs + cards (all scroll together with Your 4) */}
              <div className="p-5">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Choose from</p>
                <div className="flex gap-2 mb-4">
                  <button
                    type="button"
                    onClick={() => setPickerTab("watched")}
                    className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      pickerTab === "watched"
                        ? "bg-amber-500 text-neutral-900"
                        : "bg-neutral-800 text-neutral-400 hover:text-white"
                    }`}
                  >
                    Watched ({watched.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPickerTab("favorites")}
                    className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      pickerTab === "favorites"
                        ? "bg-amber-500 text-neutral-900"
                        : "bg-neutral-800 text-neutral-400 hover:text-white"
                    }`}
                  >
                    Favorites ({favorites.length})
                  </button>
                </div>
                <div className="rounded-xl border border-neutral-700 bg-neutral-800/50 p-4">
                  {!loaded ? (
                    <p className="text-neutral-500 text-sm py-12 text-center">Loading…</p>
                  ) : pickerList.length === 0 ? (
                    <p className="text-neutral-500 text-sm py-12 text-center">
                      {pickerTab === "watched" ? "No watched titles yet." : "No favorites yet."}
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {pickerList.map((it) => (
                        <button
                          key={`${it.item_type}-${it.item_id}`}
                          type="button"
                          onClick={() => handlePickItem(it)}
                          className="text-left rounded-xl overflow-hidden border-2 border-neutral-600 bg-neutral-800 hover:border-amber-500/60 hover:bg-neutral-700 transition-all group"
                        >
                          <div className="aspect-2/3 bg-neutral-700 overflow-hidden">
                            <img
                              src={getPosterUrl(it.image_url)}
                              alt={it.item_name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            />
                          </div>
                          <p className="p-3 text-sm font-medium text-white truncate" title={it.item_name}>
                            {it.item_name}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer — fixed at bottom, always visible */}
            <div className="shrink-0 p-5 border-t border-neutral-700 bg-neutral-900 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-neutral-300 hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl text-sm font-medium bg-amber-500 text-neutral-900 hover:bg-amber-400 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
