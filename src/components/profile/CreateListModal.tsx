"use client";

import React, { useState } from "react";

export default function CreateListModal({
  open,
  onClose,
  onSuccess,
  initialName = "",
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** A starting name, from an idea the page offered; give the modal a `key` so it takes a new one. */
  initialName?: string;
}) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "followers" | "private">("public");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/user-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          description: description.trim() || undefined,
          visibility,
        }),
        credentials: "include",
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error || "Failed to create list");
        return;
      }
      setName("");
      setDescription("");
      setVisibility("public");
      onSuccess();
      // Done: close, so it doesn't look as if nothing happened.
      onClose();
    } catch {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sheet rounded-sheet bg-overlay p-6 shadow-2xl ring-1 ring-line-strong">
        <h3 className="mb-5 font-display text-2xl text-ink-0">A new list</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="list-name" className="mb-1.5 block text-sm font-medium text-ink-0">
              Name
            </label>
            <input
              id="list-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Best 2024"
              className="w-full rounded-control bg-raised px-3 py-2.5 text-base text-ink-0 ring-1 ring-inset ring-line-input placeholder:text-ink-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="list-desc" className="mb-1.5 block text-sm font-medium text-ink-0">
              Description (optional)
            </label>
            <textarea
              id="list-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this list about?"
              rows={2}
              className="w-full resize-none rounded-control bg-raised px-3 py-2.5 text-base text-ink-0 ring-1 ring-inset ring-line-input placeholder:text-ink-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-0">Visibility</label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as "public" | "followers" | "private")}
              className="h-11 w-full rounded-control bg-raised px-3 text-base text-ink-0 ring-1 ring-inset ring-line-input focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <option value="public">Public</option>
              <option value="followers">Followers only</option>
              <option value="private">Private</option>
            </select>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 items-center rounded-full px-5 text-sm font-medium text-ink-300 transition-colors hover:bg-hover hover:text-ink-0"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-11 items-center rounded-full bg-action px-6 text-sm font-semibold text-on-action transition-colors hover:bg-action-hover disabled:opacity-60"
            >
              {loading ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
