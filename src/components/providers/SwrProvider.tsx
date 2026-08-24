"use client";

import { SWRConfig } from "swr";
import type { ReactNode } from "react";
import { SwrFetchError } from "@/utils/swrFetcher";

export default function SwrProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        /**
         * SWR refetches every active key whenever the window regains focus.
         * That is a sensible default for a dashboard and an expensive one here:
         * a detail page holds four or five keys — the room, watch providers,
         * takes, comments — so every alt-tab back to the site fired that many
         * function invocations for data that had not changed. On a paid plan
         * those are billed.
         *
         * Turned off rather than lengthened, because everything that genuinely
         * needs to be fresh already refreshes explicitly: every mutation here
         * calls `mutate()` on the keys it affects, and navigating remounts.
         * Focus was refetching on behalf of nobody.
         */
        revalidateOnFocus: false,
        /**
         * Reconnect stays on. Coming back from an offline gap is a real reason
         * to distrust what is on screen, and it is rare enough to be free.
         */
        revalidateOnReconnect: true,
        /**
         * A minute, up from SWR's 2s default: two components asking for the
         * same key inside that window become one request.
         */
        dedupingInterval: 60_000,
        // SWR retries on any thrown error by default. Auth/permission/not-found
        // responses aren't transient, so retrying them just spams the API.
        shouldRetryOnError: (err: unknown) => {
          const status = err instanceof SwrFetchError ? err.status : undefined;
          if (status && [401, 403, 404].includes(status)) return false;
          return true;
        },
      }}
    >
      {children}
    </SWRConfig>
  );
}
