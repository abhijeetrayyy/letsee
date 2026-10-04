"use client";

import { useEffect } from "react";
import toast from "react-hot-toast";
import { claimShareLink } from "@/lib/db/shareLinks";
import { forgetPassToken, readPassToken } from "@/lib/people/invite";

/**
 * A pass opened by link while signed out (migration 108) is kept the first
 * time the person is signed in — after joining or signing in — so it waits in
 * their Up next, from whoever sent it. Runs once per pending link.
 */
export function useClaimPendingPass(signedIn: boolean) {
  useEffect(() => {
    if (!signedIn) return;
    const token = readPassToken();
    if (!token) return;
    void claimShareLink(token).then((result) => {
      // Kept, yours or gone: done with it. A network error keeps it for next time.
      if (result !== "error") forgetPassToken();
      if (result === "kept") toast.success("The film you were passed is waiting in Up next.");
    });
  }, [signedIn]);
}
