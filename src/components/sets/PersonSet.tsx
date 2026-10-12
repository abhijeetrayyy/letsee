"use client";

import useSWR from "swr";
import KeepSet from "@components/sets/KeepSet";
import SetProgress from "@components/sets/SetProgress";
import { swrFetcher } from "@/utils/swrFetcher";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import { personSetItems, roleFor } from "@/lib/people/sets";
import type { PersonWorkResponse } from "@/app/api/person-work/route";

/**
 * A person as a set (docs/IDEAS_2026-10.md §2.1): the work they're known for —
 * every film a director made, a creator's series, an actor's real roles —
 * kept to work through. The same `/api/person-work` read (and cache entry) as
 * a title page's "More from the director".
 */
export default function PersonSet({ personId, name, profilePath, department }: { personId: number; name: string; profilePath: string | null; department: string | null }) {
  const { user } = useAuth();
  const { data } = useSWR<PersonWorkResponse>(user ? `/api/person-work?id=${personId}` : null, swrFetcher, { revalidateOnFocus: false });
  if (!user || !data) return null;
  const role = roleFor(department, { directed: data.directed.length, created: data.created.length });
  const items = personSetItems(role, data);
  if (items.length < 2) return null;
  const what = role === "director" ? "films" : role === "creator" ? "series" : "roles";
  const ref = { kind: "person" as const, refId: String(personId), role };
  return (
    <div className="mb-6 grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <KeepSet setRef={ref} name={name} imageUrl={profilePath} label={`Keep their ${items.length} ${what} as a set`} />
      </div>
      <SetProgress setRef={ref} name={name} imageUrl={profilePath} items={items} />
    </div>
  );
}
