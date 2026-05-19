"use client";

import { useState, useEffect } from "react";
import { Film, Users, Star, Hash, Tv, MessageSquare, Video, Image, Clapperboard } from "lucide-react";

const sections = [
  { id: "overview", label: "Overview", icon: Clapperboard },
  { id: "actions", label: "Actions", icon: Star },
  { id: "social", label: "Social", icon: Users },
  { id: "ratings", label: "Ratings", icon: Star },
  { id: "cast", label: "Cast", icon: Users },
  { id: "media", label: "Media", icon: Video },
  { id: "more", label: "More", icon: Film },
];

export default function SectionNav() {
  const [active, setActive] = useState("overview");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      setVisible(scrollY > 500);

      // Find which section is in view
      for (const s of sections) {
        const el = document.getElementById(`section-${s.id}`);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 200 && rect.bottom >= 200) {
            setActive(s.id);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(`section-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActive(id);
    }
  };

  if (!visible) return null;

  return (
    <nav className="fixed right-4 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-1.5">
      {sections.map((s) => {
        const Icon = s.icon;
        const isActive = active === s.id;
        return (
          <button
            key={s.id}
            onClick={() => scrollTo(s.id)}
            className={`group relative flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 ${
              isActive
                ? "bg-brand-500/20 text-brand-400 border border-brand-500/30"
                : "bg-surface-900/60 text-surface-500 hover:text-surface-200 hover:bg-surface-800/60 border border-surface-700/30"
            }`}
            title={s.label}
          >
            <Icon className="w-4 h-4" />
            <span className="absolute right-full mr-2 px-2 py-0.5 rounded-md bg-surface-900 border border-surface-700 text-xs text-surface-200 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              {s.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
