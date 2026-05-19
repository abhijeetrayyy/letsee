"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import MediaCard from "@components/cards/MediaCard";
import {
  GripVertical, Trash2, CheckSquare, Square, BarChart3,
  RotateCcw, Filter,
} from "lucide-react";

type SmartItem = {
  id: number;
  itemId: string;
  itemName: string;
  itemType: string;
  imageUrl: string | null;
  genres: string[] | null;
  addedAt: string;
  predictedRating: number;
  reason: string;
};

type TasteItem = { genre: string; affinity: number; sampleCount: number };

type SmartWatchlistData = {
  items: SmartItem[];
  tasteProfile: TasteItem[];
  total: number;
  note?: string;
};

const RANGE_LABELS = ["1-3", "3-5", "5-7", "7-9", "9-10"];
const RANGE_MIN = [1, 3, 5, 7, 9];
const RANGE_MAX = [3, 5, 7, 9, 10.1];

function getRatingRange(r: number): number {
  if (r < 3) return 0;
  if (r < 5) return 1;
  if (r < 7) return 2;
  if (r < 9) return 3;
  return 4;
}

function buildHistogram(items: SmartItem[]): number[] {
  const counts = [0, 0, 0, 0, 0];
  for (const item of items) {
    counts[getRatingRange(item.predictedRating)]++;
  }
  return counts;
}

const ORDER_STORAGE_KEY = "sw_order";

function loadOrder(userId: string): Record<string, number> | null {
  try {
    const raw = localStorage.getItem(`${ORDER_STORAGE_KEY}_${userId}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveOrder(userId: string, order: Record<string, number>) {
  try {
    localStorage.setItem(`${ORDER_STORAGE_KEY}_${userId}`, JSON.stringify(order));
  } catch { /* noop */ }
}

function clearOrder(userId: string) {
  try {
    localStorage.removeItem(`${ORDER_STORAGE_KEY}_${userId}`);
  } catch { /* noop */ }
}

export default function SmartWatchlist({ userId }: { userId: string }) {
  const [data, setData] = useState<SmartWatchlistData | null>(null);
  const [orderedItems, setOrderedItems] = useState<SmartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [removing, setRemoving] = useState(false);
  const dragItem = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/watchlist/smart");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Failed to load");
        return;
      }
      const json: SmartWatchlistData = await res.json();
      setData(json);

      // Apply saved order if exists
      const savedOrder = loadOrder(userId);
      if (savedOrder && json.items.length > 0) {
        const ordered = [...json.items].sort((a, b) => {
          const oa = savedOrder[a.itemId] ?? 9999;
          const ob = savedOrder[b.itemId] ?? 9999;
          return oa - ob;
        });
        setOrderedItems(ordered);
      } else {
        setOrderedItems(json.items);
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Drag handlers
  const handleDragStart = (index: number) => {
    setDragIdx(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIdx(index);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === dropIndex) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }

    const newItems = [...orderedItems];
    const [moved] = newItems.splice(dragIdx, 1);
    newItems.splice(dropIndex, 0, moved);

    // Save order
    const order: Record<string, number> = {};
    newItems.forEach((item, i) => { order[item.itemId] = i; });
    saveOrder(userId, order);

    setOrderedItems(newItems);
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    setDragIdx(null);
    setDragOverIdx(null);
  };

  // Reset to server sort
  const resetSort = () => {
    clearOrder(userId);
    if (data) setOrderedItems([...data.items]);
  };

  // Toggle select
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === displayItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayItems.map((i) => i.id)));
    }
  };

  // Remove selected
  const removeSelected = async () => {
    if (selectedIds.size === 0 || removing) return;
    setRemoving(true);
    const ids = [...selectedIds];
    try {
      await Promise.all(
        ids.map((id) => {
          const item = orderedItems.find((i) => i.id === id);
          if (!item) return Promise.resolve();
          return fetch("/api/deletewatchlistButton", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ itemId: item.itemId }),
          });
        }),
      );
      setSelectedIds(new Set());
      setBatchMode(false);
      fetchData();
    } catch {
      // fallback: refetch
      fetchData();
    } finally {
      setRemoving(false);
    }
  };

  // Remove single
  const removeSingle = async (item: SmartItem) => {
    const prevItems = orderedItems;
    setOrderedItems((prev) => prev.filter((i) => i.id !== item.id));
    try {
      await fetch("/api/deletewatchlistButton", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.itemId }),
      });
    } catch {
      setOrderedItems(prevItems);
    }
  };

  const histogram = data ? buildHistogram(data.items) : [];
  const maxHistCount = Math.max(...histogram, 1);
  const displayItems = showAll ? orderedItems : orderedItems.slice(0, 10);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="md" className="border-t-white shrink-0" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-800/40 bg-red-900/20 p-6 text-center">
        <p className="text-red-400 text-sm">{error}</p>
        <button onClick={fetchData} className="mt-2 text-xs text-brand-400 hover:underline">Retry</button>
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="rounded-xl border border-surface-700/60 bg-surface-900/40 p-8 text-center">
        <p className="text-surface-400 text-sm">{data?.note ?? "Your watchlist is empty."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-surface-100">Smart Watchlist</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setBatchMode(!batchMode); setSelectedIds(new Set()); }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition-all ${
              batchMode
                ? "bg-brand-500/10 border-brand-500/30 text-brand-300"
                : "bg-surface-800 border-surface-700/50 text-surface-400 hover:text-surface-200"
            }`}
          >
            <CheckSquare className="w-3 h-3" />
            {batchMode ? "Done" : "Select"}
          </button>
          <button
            onClick={resetSort}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-surface-800 border border-surface-700/50 text-surface-400 hover:text-surface-200 rounded-lg transition-all"
            title="Reset to predicted rating order"
          >
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        </div>
      </div>

      {/* Taste Profile */}
      {data.tasteProfile.length > 0 && (
        <div className="rounded-xl border border-surface-700/50 bg-gradient-to-br from-surface-900/80 to-surface-900/40 p-4">
          <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">Your Taste Profile</h4>
          <div className="flex flex-wrap gap-2">
            {data.tasteProfile.map((t) => (
              <div key={t.genre} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-800 text-xs">
                <span className="text-surface-200">{t.genre}</span>
                <span className={t.affinity > 0 ? "text-green-400" : "text-red-400"}>
                  {t.affinity > 0 ? "+" : ""}{t.affinity}%
                </span>
                <span className="text-surface-500">({t.sampleCount})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Predicted Rating Distribution Histogram */}
      {data.items.length > 1 && (
        <div className="rounded-xl border border-surface-700/50 bg-gradient-to-br from-surface-900/80 to-surface-900/40 p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-brand-400" />
            <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Rating Distribution</h4>
          </div>
          <div className="flex items-end gap-2 h-16">
            {histogram.map((count, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-sm transition-all duration-500"
                  style={{
                    height: `${(count / maxHistCount) * 100}%`,
                    minHeight: count > 0 ? "4px" : "0",
                    background: `rgba(${99 + i * 30}, ${102 + i * 20}, 241, 0.6)`,
                  }}
                />
                <span className="text-[9px] text-surface-500">{RANGE_LABELS[i]}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-surface-500 mt-2 text-center">
            {Math.round((histogram[3] + histogram[4]) / data.items.length * 100)}% of items are high confidence (7+)
          </p>
        </div>
      )}

      {/* Batch actions bar */}
      {batchMode && selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20">
          <span className="text-sm text-surface-200">{selectedIds.size} selected</span>
          <button
            onClick={removeSelected}
            disabled={removing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all disabled:opacity-50"
          >
            <Trash2 className="w-3 h-3" />
            {removing ? "Removing..." : "Remove selected"}
          </button>
        </div>
      )}

      {/* Sort indicator */}
      <div className="flex items-center gap-2 text-[11px] text-surface-500">
        <GripVertical className="w-3 h-3" />
        <span>Drag to reorder</span>
        <Filter className="w-3 h-3 ml-2" />
        <span>Sorted by predicted rating</span>
      </div>

      {/* Item grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
        {displayItems.map((item, idx) => {
          const isSelected = selectedIds.has(item.id);
          const isDragging = dragIdx === idx;
          const isOver = dragOverIdx === idx;

          return (
            <div
              key={item.id}
              ref={dragIdx === idx ? dragItem : null}
              draggable={!batchMode}
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
              className={`relative group animate-in fade-in slide-in-from-bottom-2 ${
                isDragging ? "opacity-50 scale-95" : ""
              } ${isOver ? "mt-4" : ""}`}
              style={{
                animationDuration: "400ms",
                animationDelay: `${idx * 60}ms`,
                animationFillMode: "both",
              }}
            >
              <MediaCard
                id={Number(item.itemId)}
                title={item.itemName}
                mediaType={item.itemType as "movie" | "tv"}
                imageUrl={item.imageUrl}
                adult={false}
                genres={Array.isArray(item.genres) ? item.genres : []}
                showActions={true}
                typeLabel={item.itemType}
              />

              {/* Drag handle */}
              {!batchMode && (
                <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-sm rounded-full p-1 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
                  <GripVertical className="w-3 h-3 text-surface-400" />
                </div>
              )}

              {/* Predicted rating badge */}
              <div
                className={`absolute top-2 right-2 rounded-full px-2 py-0.5 text-xs font-bold backdrop-blur-sm ${
                  item.predictedRating >= 7
                    ? "bg-green-500/80 text-white"
                    : item.predictedRating >= 5
                      ? "bg-yellow-500/80 text-black"
                      : "bg-red-500/80 text-white"
                }`}
              >
                {item.predictedRating}
              </div>

              {/* Reason badge */}
              {item.reason !== "No genre data" && !batchMode && (
                <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm rounded px-1.5 py-0.5 text-[10px] text-surface-300 max-w-[90%] truncate">
                  {item.reason}
                </div>
              )}

              {/* Remove button (non-batch) */}
              {!batchMode && (
                <button
                  onClick={() => removeSingle(item)}
                  className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm rounded-full p-1 opacity-0 group-hover:opacity-100 hover:opacity-100 hover:bg-red-500/60 transition-all"
                  title="Remove from watchlist"
                >
                  <Trash2 className="w-3 h-3 text-surface-400 hover:text-white" />
                </button>
              )}

              {/* Batch select checkbox */}
              {batchMode && (
                <button
                  onClick={() => toggleSelect(item.id)}
                  className={`absolute inset-0 z-10 flex items-start justify-end p-2 ${
                    isSelected ? "bg-brand-500/10 ring-2 ring-brand-500 rounded-xl" : ""
                  }`}
                >
                  <div className={`rounded p-0.5 ${isSelected ? "bg-brand-500 text-white" : "bg-black/50 text-surface-400"}`}>
                    {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  </div>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Batch select all / deselect all */}
      {batchMode && displayItems.length > 0 && (
        <div className="flex items-center justify-center gap-3">
          <button onClick={toggleSelectAll} className="text-xs text-surface-400 hover:text-surface-200 transition-colors">
            {selectedIds.size === displayItems.length ? "Deselect all" : "Select all"}
          </button>
        </div>
      )}

      {/* Show all / show top 10 */}
      {orderedItems.length > 10 && (
        <div className="text-center">
          <button onClick={() => setShowAll(!showAll)} className="text-sm text-brand-400 hover:underline">
            {showAll ? "Show top 10" : `Show all ${orderedItems.length} items`}
          </button>
        </div>
      )}

      <p className="text-xs text-surface-500 text-center">
        Drag to reorder or use batch select.
        {orderedItems.length > 0 && ` ${orderedItems.length} items in watchlist.`}
      </p>
    </div>
  );
}
