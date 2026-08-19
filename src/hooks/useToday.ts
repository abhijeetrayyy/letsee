"use client";

import { useEffect, useState } from "react";
import type { ParsedDate } from "@/utils/person/dates";

/**
 * The reader's date, once the client has it. `null` until then.
 *
 * Anything counted *from today* — "in 3 days", "airing soon" — is a different
 * string on a server in one timezone and a browser in another, which is exactly
 * the hydration failure releaseInfo.ts was written to prevent. So the absolute
 * date renders on the server, where it is a fact about the film, and the
 * relative part arrives a tick later, where it is a fact about the reader.
 *
 * Callers should render the absolute form while this is null rather than a
 * spinner: the information is already there, only the comparison is waiting.
 *
 * This also collapses a third copy of the same three lines. `todayParts()` was
 * defined privately in utils/person/dates.ts, again in ReleaseTimeline.tsx, and
 * inlined a third time in NextEpisode.tsx.
 */
export function useToday(): ParsedDate | null {
  const [today, setToday] = useState<ParsedDate | null>(null);
  useEffect(() => {
    const now = new Date();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the clock is not derivable during render
    setToday({ y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() });
  }, []);
  return today;
}
