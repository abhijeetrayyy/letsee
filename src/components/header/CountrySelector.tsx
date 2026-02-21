"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { FaChevronDown, FaGlobe } from "react-icons/fa6";
import { useCountry } from "@/app/contextAPI/countryContext";
import { Countrydata } from "@/staticData/countryName";

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
        className="flex h-10 items-center gap-2 rounded-xl border border-neutral-700/60 bg-neutral-800 px-3 py-2 text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-700"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Select country for streaming availability"
      >
        <FaGlobe className="size-4 shrink-0 text-neutral-400" />
        <span className="hidden max-w-[80px] truncate sm:inline">
          {selectedCountry?.english_name ?? country}
        </span>
        <FaChevronDown
          className={`size-3.5 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-neutral-700 bg-neutral-800 shadow-xl"
          role="listbox"
        >
          <div className="p-2 border-b border-neutral-700">
            <input
              type="text"
              placeholder="Search country..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-lg border border-neutral-600 bg-neutral-900 px-3 py-2 text-sm text-white placeholder-neutral-500 outline-none focus:border-neutral-500"
            />
          </div>
          <div
            className="overflow-y-auto py-1"
            style={{ maxHeight: DROPDOWN_HEIGHT }}
          >
            {filtered.length === 0 ? (
              <p className="px-4 py-4 text-center text-sm text-neutral-400">
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
                      ? "bg-neutral-600 text-white"
                      : "text-neutral-200 hover:bg-neutral-700 hover:text-white"
                  }`}
                  role="option"
                  aria-selected={c.iso_3166_1 === country}
                >
                  <span className="font-mono text-xs text-neutral-400">
                    {c.iso_3166_1}
                  </span>
                  <span>{c.english_name}</span>
                </button>
              ))
            )}
          </div>
          {platforms.length > 0 && (
            <div className="border-t border-neutral-700 px-3 py-2">
              <p className="text-xs text-neutral-400 mb-1">
                Platforms in {selectedCountry?.english_name ?? country}
              </p>
              <p className="text-xs text-neutral-300 line-clamp-2">
                {platforms.join(", ")}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
