"use client";

import useSWR from "swr";
import toast from "react-hot-toast";
import { useState } from "react";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import { dropSet, fetchSets, keepSet } from "@/lib/db/sets";
import { setKey, type SetRef } from "@/lib/people/sets";
import { markToast } from "@components/ds/markToast";

/** Whether you keep this set, and the switch — one cache entry for all of your sets (`["sets", me]`). */
export function useKeptSet(ref: SetRef, name: string, imageUrl: string | null) {
  const { user } = useAuth();
  const me = user?.id ?? null;
  const { data: sets, mutate } = useSWR(me ? ["sets", me] : null, () => fetchSets(me!), { revalidateOnFocus: false });
  const [busy, setBusy] = useState(false);
  const kept = !!sets?.some((s) => setKey(s) === setKey(ref));

  const toggle = async () => {
    if (!me || busy) return;
    const on = !kept;
    setBusy(true);
    const ok = on ? await keepSet(me, ref, name, imageUrl) : await dropSet(me, ref);
    await mutate();
    setBusy(false);
    if (!ok) {
      toast.error("That didn't save. Check your connection and try again.");
      return;
    }
    markToast({
      text: on ? `Keeping ${name} as a set` : `${name} is no longer one of your sets`,
      hint: on ? "Your progress shows here and on your profile. Nothing's lost if you stop." : undefined,
      undo: async () => {
        await (on ? dropSet(me, ref) : keepSet(me, ref, name, imageUrl));
        await mutate();
      },
    });
  };
  return { signedIn: !!me, me, kept, busy, toggle };
}
