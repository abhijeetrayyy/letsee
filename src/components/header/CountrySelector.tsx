"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { useCountry } from "@/app/contextAPI/countryContext";
import { Countrydata } from "@/staticData/countryName";
import { ChevronDownIcon, GlobeIcon } from "lucide-react";

const DROPDOWN_HEIGHT = 280;

export default function CountrySelector() {
  const { country, setCountry } = useCountry();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !country) return;
    fetch(`/api/watch-providers/list?region=${country}&mediaType=movie`)
      .then((r) => r.json())
      .then((data) => {
        const names = (data?.providers ?? []).map((p: { name: string }) => p.name);
        setPlatforms(names.slice(0, 12));
      })
      .catch(() => setPlatforms([]));
  }, [isOpen, country]);

  const selectedCountry = Countrydata.find(
    (c) => c.iso_3166_1 === country
  ) ?? Countrydata.find((c) => c.iso_3166_1 === "US");

  const filtered = useMemo(() => {
    if (!query.trim()) return Countrydata.slice(0, 200);
    const q = query.toLowerCase().trim();
    return Countrydata.filter(
      (c) =>
        c.english_name.toLowerCase().includes(q) ||
        c.native_name.toLowerCase().includes(q) ||
        c.iso_3166_1.toLowerCase().includes(q)
    );
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="flex h-10 items-center gap-2 rounded-xl border border-line-strong/60 bg-overlay px-3 py-2 text-sm font-medium text-ink-200 transition-colors hover:bg-hover"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Select country for streaming availability"
      >
        <GlobeIcon className="size-4 shrink-0 text-ink-400" />
        <span className="hidden max-w-20 truncate sm:inline">
          {selectedCountry?.english_name ?? country}
        </span>
        <ChevronDownIcon
          className={`size-3.5 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-line-strong bg-overlay shadow-xl"
          role="listbox"
        >
          <div className="p-2 border-b border-line-strong">
            <input
              type="text"
              placeholder="Search country..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-lg border border-line-input bg-raised px-3 py-2 text-sm text-ink-0 placeholder-ink-500 outline-none focus:border-line-bold"
            />
          </div>
          <div
            className="overflow-y-auto py-1"
            style={{ maxHeight: DROPDOWN_HEIGHT }}
          >
            {filtered.length === 0 ? (
              <p className="px-4 py-4 text-center text-sm text-ink-400">
                No countries match
              </p>
            ) : (
              filtered.slice(0, 150).map((c) => (
                <button
                  key={c.iso_3166_1}
                  type="button"
                  onClick={() => {
                    setCountry(c.iso_3166_1);
                    setIsOpen(false);
                    setQuery("");
                  }}
                  className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors ${
                    c.iso_3166_1 === country
                      ? "bg-active text-ink-0"
                      : "text-ink-200 hover:bg-hover hover:text-ink-0"
                  }`}
                  role="option"
                  aria-selected={c.iso_3166_1 === country}
                >
                  <span className="font-mono text-xs text-ink-400">
                    {c.iso_3166_1}
                  </span>
                  <span>{c.english_name}</span>
                </button>
              ))
            )}
          </div>
          {platforms.length > 0 && (
            <div className="border-t border-line-strong px-3 py-2">
              <p className="text-xs text-ink-400 mb-1">
                Platforms in {selectedCountry?.english_name ?? country}
              </p>
              <p className="text-xs text-ink-300 line-clamp-2">
                {platforms.join(", ")}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
