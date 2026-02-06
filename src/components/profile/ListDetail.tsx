"use client";

import React, { useState, useEffect, useCallback } from "react";
import MediaCard from "@/components/cards/MediaCard";
import SendMessageModal from "@components/message/sendCard";
import { useApiFetch } from "@/hooks/useApiFetch";
import { FetchError } from "@/components/ui/FetchError";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

type ListInfo = {
  id: number;
  user_id: string;
  name: string;
  description: string | null;
  visibility: string;
  items_count: number;
  is_owner?: boolean;
  created_at: string;
  updated_at: string;
};

type ListItemRow = {
  id: number;
  item_id: string;
  item_type: string;
  item_name: string;
  image_url: string | null;
  item_adult: boolean;
  position: number;
  created_at: string;
};

export default function ListDetail({ listId }: { listId: number }) {
  const [items, setItems] = useState<ListItemRow[]>([]);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareCardData, setShareCardData] = useState<any>(null);

  const {
    data: listData,
    error: listError,
    loading: listLoading,
    refetch: refetchList,
  } = useApiFetch<{ list: ListInfo }>(`/api/user-lists/${listId}`, {
    credentials: "include",
    enabled: true,
  });

  const fetchItems = useCallback(async () => {
    const res = await fetch(`/api/user-lists/${listId}/items`, { credentials: "include" });
    if (!res.ok) return;
    const body = await res.json();
    setItems(body.items ?? []);
  }, [listId]);

  useEffect(() => {
    if (listData?.list) fetchItems();
  }, [listData?.list, fetchItems]);

  const handleRemove = async (itemId: string) => {
    const res = await fetch(`/api/user-lists/${listId}/items?itemId=${encodeURIComponent(itemId)}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) setItems((prev) => prev.filter((i) => i.item_id !== itemId));
  };

  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    try {
      const res = await fetch(
        `/api/search?query=${encodeURIComponent(q)}&media_type=multi`,
        { credentials: "include" }
      );
      const body = await res.json();
      const results = body?.results ?? [];
      const filtered = (Array.isArray(results) ? results : [])
        .filter((r: any) => r.media_type === "movie" || r.media_type === "tv")
        .slice(0, 15);
      setSearchResults(filtered);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleAddItem = async (item: { id: number; title?: string; name?: string; poster_path?: string; media_type?: string }) => {
    const name = item.title ?? item.name ?? "";
    const mediaType = (item.media_type === "tv" ? "tv" : "movie") as "movie" | "tv";
    const imgUrl = item.poster_path ? `https://image.tmdb.org/t/p/w92${item.poster_path}` : undefined;
    const res = await fetch(`/api/user-lists/${listId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemId: String(item.id),
        itemType: mediaType,
        name,
        imgUrl,
        adult: false,
      }),
      credentials: "include",
    });
    if (res.ok) {
      setAddModalOpen(false);
      setSearchQuery("");
      setSearchResults([]);
      fetchItems();
    }
  };

  const list = listData?.list;

  const handleShare = (item: ListItemRow) => {
    setShareCardData({
      id: item.item_id,
      media_type: item.item_type,
      title: item.item_name,
      name: item.item_name,
      poster_path: item.image_url,
    });
    setShareModalOpen(true);
  };

  if (listLoading || !list) {
    if (listError) {
      return (
        <div className="max-w-4xl mx-auto p-6">
          <FetchError
            message={listError === "Request failed (401)" ? "Log in to view this list." : listError}
            onRetry={refetchList}
          />
        </div>
      );
    }
    return (
      <div className="max-w-4xl mx-auto p-6 flex flex-col items-center justify-center gap-4 py-16 min-h-[200px]">
        <LoadingSpinner size="lg" className="border-t-white shrink-0" />
        <p className="text-neutral-500 text-sm animate-pulse">Loading list…</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <SendMessageModal
        data={shareCardData}
        media_type={shareCardData?.media_type ?? null}
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
      />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-100">{list.name}</h1>
        {list.description && <p className="text-neutral-400 mt-1">{list.description}</p>}
        <p className="text-sm text-neutral-500 mt-1">{list.visibility} · {items.length} item{items.length !== 1 ? "s" : ""}</p>
      </div>

      {list.is_owner && (
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-all duration-200 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-neutral-900"
          >
            Add item
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-xl border border-neutral-700/60 bg-neutral-800/30 p-8 text-center">
          <p className="text-neutral-400 text-sm">No items yet.</p>
          <p className="text-neutral-500 text-sm mt-1">Add movies or TV shows using the button above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {items.map((item) => (
            <div key={item.id} className="relative">
              <MediaCard
                id={Number(item.item_id)}
                title={item.item_name}
                mediaType={item.item_type === "tv" ? "tv" : "movie"}
                imageUrl={item.image_url}
                adult={!!item.item_adult}
                genres={[]}
                showActions={true}
                onShare={() => handleShare(item)}
                typeLabel={item.item_type}
                subtitle={
                  list?.is_owner ? (
                    <button
                      type="button"
                      onClick={() => handleRemove(item.item_id)}
                      className="mt-1 text-xs text-amber-200 hover:text-amber-100 hover:bg-amber-500/20 rounded px-2 py-1 transition"
                    >
                      Remove from list
                    </button>
                  ) : undefined
                }
              />
            </div>
          ))}
        </div>
      )}

      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/70 overflow-y-auto">
          <div className="bg-neutral-800 rounded-xl border border-neutral-600 w-full max-w-lg p-6 mt-8">
            <h3 className="text-xl font-semibold text-neutral-100 mb-4">Add to list</h3>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search movie or TV show..."
                className="flex-1 px-3 py-2 rounded-lg bg-neutral-700 border border-neutral-600 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={handleSearch}
                disabled={searching}
                aria-busy={searching}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium disabled:opacity-60 flex items-center justify-center gap-2 min-w-[100px] transition-all duration-200 active:scale-[0.98]"
              >
                {searching ? (
                  <>
                    <LoadingSpinner size="sm" className="border-t-white shrink-0" />
                    <span>Searching…</span>
                  </>
                ) : (
                  "Search"
                )}
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {searching && searchResults.length === 0 && searchQuery.trim() ? (
                <div className="py-6 flex flex-col items-center justify-center gap-2 text-neutral-500 text-sm">
                  <LoadingSpinner size="sm" className="border-t-white shrink-0" />
                  <span className="animate-pulse">Searching…</span>
                </div>
              ) : !searching && searchResults.length === 0 && searchQuery.trim() ? (
                <p className="py-4 text-center text-neutral-500 text-sm">No results for &quot;{searchQuery.trim()}&quot;. Try another title.</p>
              ) : null}
              {searchResults.map((r) => (
                <button
                  key={`${r.media_type ?? "movie"}-${r.id}`}
                  type="button"
                  onClick={() => handleAddItem(r)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-neutral-700 text-left transition-all duration-200 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:ring-inset"
                >
                  {r.poster_path ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w92${r.poster_path}`}
                      alt=""
                      className="w-10 h-14 rounded object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-14 rounded bg-neutral-700 shrink-0" />
                  )}
                  <span className="font-medium text-neutral-100 truncate">{r.title ?? r.name}</span>
                  <span className="text-xs text-neutral-500">{r.media_type ?? "movie"}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => { setAddModalOpen(false); setSearchQuery(""); setSearchResults([]); }}
              className="mt-4 px-4 py-2 text-neutral-300 hover:bg-neutral-700 rounded-lg transition-all duration-200 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:ring-offset-2 focus:ring-offset-neutral-800"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
