"use client";

import { useState, useEffect, useRef } from "react";

type NavItem = { id: string; label: string; icon: string };

export default function StickySectionNav({
  items,
  activeSection,
  onNavigate,
}: {
  items: NavItem[];
  activeSection: string;
  onNavigate: (id: string) => void;
}) {
  const [stuck, setStuck] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting),
      { threshold: 0, rootMargin: "-1px 0px 0px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinelRef} className="h-0 pointer-events-none" />
      <div
        className={`transition-all duration-300 z-30 ${
          stuck
            ? "fixed top-0 left-0 right-0 bg-surface-950/95 backdrop-blur-lg border-b border-surface-800/50 shadow-xl"
            : "relative"
        }`}
      >
        <div className={`flex overflow-x-auto no-scrollbar ${stuck ? "max-w-5xl mx-auto px-4" : ""}`}>
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap shrink-0 ${
                activeSection === item.id
                  ? "border-brand-500 text-brand-400"
                  : "border-transparent text-surface-400 hover:text-surface-200 hover:border-surface-600"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
      {stuck && <div className="h-[49px]" />}
    </>
  );
}
