"use client";

import { useState } from "react";
import { BookOpen, MessageSquare, Film, List, LayoutDashboard, BarChart3, Bell, Tv } from "lucide-react";

type TabId = "diary" | "reviews" | "films" | "lists" | "dashboard" | "stats" | "activity" | "series";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "diary", label: "Diary", icon: <BookOpen className="w-4 h-4" /> },
  { id: "reviews", label: "Reviews", icon: <MessageSquare className="w-4 h-4" /> },
  { id: "films", label: "Films", icon: <Film className="w-4 h-4" /> },
  { id: "lists", label: "Lists", icon: <List className="w-4 h-4" /> },
  { id: "series", label: "Series", icon: <Tv className="w-4 h-4" /> },
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: "stats", label: "Stats", icon: <BarChart3 className="w-4 h-4" /> },
  { id: "activity", label: "Activity", icon: <Bell className="w-4 h-4" /> },
];

export default function ProfileTabsNew({
  diary, reviews, films, lists, series,
  dashboard, stats, activity,
}: {
  diary: React.ReactNode;
  reviews: React.ReactNode;
  films: React.ReactNode;
  lists: React.ReactNode;
  series?: React.ReactNode;
  dashboard?: React.ReactNode;
  stats: React.ReactNode;
  activity: React.ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("diary");

  return (
    <div className="w-full">
      {/* Tab Bar */}
      <div className="flex overflow-x-auto no-scrollbar border-b border-surface-700/60 gap-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? "border-brand-500 text-brand-400"
                : "border-transparent text-surface-400 hover:text-surface-200 hover:border-surface-600"
            }`}
          >
            <span className={activeTab === tab.id ? "text-brand-400" : "text-surface-500"}>{tab.icon}</span>
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
        {activeTab === "series" && (series ?? <p className="text-surface-500 text-sm text-center py-8">No TV series data available.</p>)}
        {activeTab === "dashboard" && (dashboard ?? stats)}
        {activeTab === "stats" && stats}
        {activeTab === "activity" && activity}
      </div>
    </div>
  );
}
