"use client";

import { useState } from "react";

type TabId = "activity" | "lists" | "all";

const TABS: { id: TabId; label: string }[] = [
  { id: "activity", label: "Activity" },
  { id: "lists", label: "Lists" },
  { id: "all", label: "Watched & more" },
];

export default function ProfileTabs({
  activity,
  lists,
  all,
}: {
  activity: React.ReactNode;
  lists: React.ReactNode;
  all: React.ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("all");

  return (
    <div className="w-full">
      {/* Pill-style tab bar */}
      <div
        className="inline-flex p-1 rounded-2xl bg-surface-800/80 border border-surface-700/60 gap-1"
        role="tablist"
        aria-label="Profile sections"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            id={`tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-2 focus:ring-offset-surface-950 ${
              activeTab === tab.id
                ? "bg-brand-500 text-surface-950 shadow-lg shadow-brand-500/20"
                : "text-surface-400 hover:text-white hover:bg-surface-700/50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab panel */}
      <div
        role="tabpanel"
        id={`panel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        className="mt-6 min-h-[200px]"
      >
        {activeTab === "activity" && activity}
        {activeTab === "lists" && lists}
        {activeTab === "all" && all}
      </div>
    </div>
  );
}
