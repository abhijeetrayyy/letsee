"use client";

import { SWRConfig } from "swr";
import type { ReactNode } from "react";
import { SwrFetchError } from "@/utils/swrFetcher";

export default function SwrProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
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
