"use client";

import { useState } from "react";
import { useAuth } from "@/app/contextAPI/AuthProvider";

/**
 * "Good evening, name".
 *
 * Two things moved to the browser here, and the second one is a fix rather than
 * a saving. The name came from a server-side session read, which is what made
 * the whole home page uncacheable. The *hour* came from `new Date().getHours()`
 * on the server — so the greeting was computed in the region the function
 * happened to run in, and told someone in Sydney "good evening" over breakfast.
 * A greeting about the time of day is about the reader's time of day.
 *
 * Rendering it after mount also keeps it out of the prerendered HTML, which is
 * the point: a cached page cannot contain an hour or a name.
 */
export default function HomeGreeting() {
  const { user, isAuthenticated, ready } = useAuth();
  /**
   * Read once, at mount, from the initialiser rather than an effect.
   *
   * There is no hydration hazard in reading the clock during render here: this
   * returns null until `ready`, and `ready` is false through the whole server
   * render and the first client render, so the greeting is never part of the
   * markup being compared. It appears only after the provider has resolved,
   * which happens in a browser and nowhere else.
   */
  const [greeting] = useState(() => {
    const hour = new Date().getHours();
    return hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  });

  if (!ready || !isAuthenticated || !user?.username) return null;

  return (
    <div className="pt-6 pb-2">
      <h1 className="text-lg sm:text-xl font-medium text-surface-300">
        Good {greeting}, <span className="text-white font-semibold">{user.username}</span>
      </h1>
    </div>
  );
}
