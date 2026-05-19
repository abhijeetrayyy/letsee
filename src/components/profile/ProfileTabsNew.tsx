"use client";

import { useState, Suspense, useEffect } from "react";
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

function TabSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-surface-800 rounded-lg w-48" />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="aspect-[2/3] bg-surface-800 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function TabErrorBoundary({ children, tabName }: { children: React.ReactNode; tabName: string }) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const errorHandler = (event: ErrorEvent) => {
      setHasError(true);
    };
    window.addEventListener("error", errorHandler);
    return () => window.removeEventListener("error", errorHandler);
  }, []);

  if (hasError) {
    return (
      <div className="text-center py-12">
        <p className="text-amber-400 font-medium">Failed to load {tabName}</p>
        <button onClick={() => setHasError(false)} className="btn-secondary mt-3 text-sm">
          Try again
        </button>
      </div>
    );
  }

  return <>{children}</>;
}

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
  const [loadedTabs, setLoadedTabs] = useState<Set<TabId>>(new Set(["diary"]));

  const handleTabClick = (tabId: TabId) => {
    setActiveTab(tabId);
    setLoadedTabs((prev) => new Set([...prev, tabId]));
  };

  const renderTabContent = (tabId: TabId, content: React.ReactNode, fallback?: React.ReactNode) => {
    if (!loadedTabs.has(tabId)) return null;
    return (
      <Suspense fallback={<TabSkeleton />}>
        <TabErrorBoundary tabName={TABS.find((t) => t.id === tabId)?.label ?? tabId}>
          {content ?? fallback ?? <p className="text-surface-500 text-sm text-center py-8">No data available.</p>}
        </TabErrorBoundary>
      </Suspense>
    );
  };

  return (
    <div className="w-full">
      {/* Tab Bar */}
      <div className="flex overflow-x-auto no-scrollbar border-b border-white/5 gap-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleTabClick(tab.id)}
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
      <div className="mt-6 min-h-[200px] animate-fade-in">
        {renderTabContent("diary", diary)}
        {renderTabContent("reviews", reviews)}
        {renderTabContent("films", films)}
        {renderTabContent("lists", lists)}
        {renderTabContent("series", series)}
        {renderTabContent("dashboard", dashboard, stats)}
        {renderTabContent("stats", stats)}
        {renderTabContent("activity", activity)}
      </div>
    </div>
  );
}
