"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import Avatar from "@components/ui/Avatar";
import { findPerson } from "@/lib/db/rooms";
import { cleanInviter, readInviter, rememberInviter } from "@/lib/people/invite";

/**
 * "ray invited you." On sign-up and sign-in, when you came through someone's
 * invitation (docs/design/PAGES.md §8): the page says whose it is.
 */
export default function InviteBanner() {
  const params = useSearchParams();
  const [from, setFrom] = useState<string | null>(null);

  useEffect(() => {
    const fromLink = cleanInviter(params.get("invite"));
    if (fromLink) rememberInviter(fromLink);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage only exists in the browser
    setFrom(fromLink ?? readInviter());
  }, [params]);

  const { data: person } = useSWR(from ? ["invite-person", from.toLowerCase()] : null, () => findPerson(from!), { revalidateOnFocus: false });
  if (!person) return null;
  return (
    <div className="mb-6 flex items-center gap-3 rounded-card bg-raised px-4 py-3 ring-1 ring-inset ring-line-strong">
      <Avatar src={person.avatarUrl} name={person.username} size={36} />
      <p className="text-sm text-ink-300">
        <span className="font-semibold text-ink-0">{person.username}</span> invited you to letsee. Once you&apos;re in, you&apos;ll go straight to them.
      </p>
    </div>
  );
}
