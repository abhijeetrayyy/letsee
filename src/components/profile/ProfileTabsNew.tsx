"use client";

import { useState } from "react";

type TabId = "diary" | "reviews" | "films" | "lists" | "dashboard" | "stats" | "activity";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "diary", label: "Diary", icon: "📅" },
  { id: "reviews", label: "Reviews", icon: "✍️" },
  { id: "films", label: "Films", icon: "🎬" },
  { id: "lists", label: "Lists", icon: "📋" },
  { id: "dashboard", label: "Dashboard", icon: "📊" },
  { id: "stats", label: "Stats", icon: "📈" },
  { id: "activity", label: "Activity", icon: "🔔" },
];

export default function ProfileTabsNew({
  diary,
  reviews,
  films,
  lists,
  dashboard,
  stats,
  activity,
}: {
  diary: React.ReactNode;
  reviews: React.ReactNode;
  films: React.ReactNode;
  lists: React.ReactNode;
  dashboard?: React.ReactNode;
  stats: React.ReactNode;
  activity: React.ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("diary");

  return (
    <div className="w-full">
      {/* Tab Bar */}
      <div className="flex overflow-x-auto no-scrollbar border-b border-surface-700/60">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? "border-brand-500 text-brand-400"
                : "border-transparent text-surface-400 hover:text-surface-200 hover:border-surface-600"
            }`}
          >
            <span className="text-base">{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Panel */}
      <div className="mt-6 min-h-[200px]">
        {activeTab === "diary" && diary}
        {activeTab === "reviews" && reviews}
        {activeTab === "films" && films}
        {activeTab === "lists" && lists}
        {activeTab === "dashboard" && (dashboard ?? stats)}
        {activeTab === "stats" && stats}
        {activeTab === "activity" && activity}
      </div>
    </div>
  );
}
