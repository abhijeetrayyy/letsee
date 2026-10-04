"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import Link from "@components/ui/AppLink";
import Avatar from "@components/ui/Avatar";
import { acceptCoLog } from "@/lib/db/viewings";
import { acceptFollowRequest, rejectFollowRequest } from "@/utils/followerAction";
import type { Request } from "@/lib/db/rooms";
import { watchedLabel } from "@components/rooms/time";

/**
 * Someone asking something of you: a follow request, or "I was there too".
 * Shown at the top of People and in Home's *Waiting on you*.
 */
export default function RequestRow({ request, onDone }: { request: Request; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<string | null>, ok: string) => {
    setBusy(true);
    const error = await fn();
    setBusy(false);
    if (error) toast.error(error);
    else {
      toast.success(ok);
      onDone();
    }
  };
  const name = <span className="font-semibold text-ink-0">{request.person.username}</span>;
  const primary = "inline-flex h-9 items-center rounded-full bg-action px-4 text-sm font-semibold text-on-action hover:bg-action-hover disabled:opacity-60";
  const quiet = "inline-flex h-9 items-center rounded-full px-3.5 text-sm font-medium text-ink-400 hover:bg-hover hover:text-ink-0 disabled:opacity-60";

  return (
    <li className="flex flex-wrap items-center gap-x-3.5 gap-y-3 px-4 py-3.5">
      <Link href={`/app/profile/${encodeURIComponent(request.person.username)}`} className="shrink-0">
        <Avatar src={request.person.avatarUrl} name={request.person.username} size={40} />
      </Link>
      <p className="min-w-0 flex-1 basis-48 text-sm text-ink-400">
        {request.kind === "follow" ? (
          <>{name} would like to follow you</>
        ) : (
          <>
            {name} says you watched{" "}
            {request.itemName ? <em className="font-display not-italic text-ink-300">{request.itemName}</em> : "something"} together
            <span className="text-ink-500"> · {watchedLabel(request.watchedOn)}</span>
          </>
        )}
      </p>
      <span className="flex gap-1.5">
        {request.kind === "follow" ? (
          <>
            <button type="button" disabled={busy} className={primary} onClick={() => run(async () => (await acceptFollowRequest(request.id)).error?.message ?? null, `${request.person.username} follows you now`)}>
              Accept
            </button>
            <button type="button" disabled={busy} className={quiet} onClick={() => run(async () => (await rejectFollowRequest(request.id)).error?.message ?? null, "Declined")}>
              Decline
            </button>
          </>
        ) : (
          <button type="button" disabled={busy} className={primary} onClick={() => run(async () => (await acceptCoLog(request.viewingId)).error, "In your diary too")}>
            I was there too
          </button>
        )}
      </span>
    </li>
  );
}

