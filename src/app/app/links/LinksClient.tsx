"use client";

import { useState } from "react";
import useSWR from "swr";
import toast from "react-hot-toast";
import { Copy, Link2, List as ListIcon } from "lucide-react";
import Link from "@components/ui/AppLink";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import { fetchMyLinks, revokeShareLink, type MyLink } from "@/lib/db/shareLinks";
import { linkState } from "@/lib/people/linkState";
import { passLinkUrl } from "@/lib/people/invite";
import { getPosterUrl } from "@/utils/imageUrl";
import { listPath, titlePath } from "@/utils/urls";

export default function LinksClient() {
  const { user, status } = useAuth();
  const me = status === "ok" ? user?.id ?? null : null;
  const { data, isLoading, mutate } = useSWR(me ? ["my-links", me] : null, () => fetchMyLinks(me!), { revalidateOnFocus: false });

  return (
    <div className="mx-auto flex w-full max-w-read flex-col gap-8 px-4 pb-16 pt-6 sm:pt-10">
      <header>
        <h1 className="text-4xl text-ink-0 sm:text-5xl">Links you&apos;ve sent</h1>
        <p className="mt-2 text-base text-ink-400">Passes, nights from your diary and lists you shared as links. Each works for thirty days; stop one and whoever has it sees that it ran out.</p>
      </header>

      {status === "anon" ? (
        <p className="text-sm text-ink-500">
          <Link href="/login?next=/app/links" className="font-medium text-accent underline decoration-line-input underline-offset-4">
            Sign in
          </Link>{" "}
          to see your links.
        </p>
      ) : isLoading || !data ? (
        <div className="grid gap-3" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 rounded-card bg-raised" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-card border border-line-strong bg-raised p-5">
          <Link2 className="size-6 text-accent" aria-hidden />
          <p className="font-display text-2xl text-ink-0">No links yet.</p>
          <p className="text-sm text-ink-400">Pass a film and choose Send as a link, share a night from your diary, or share one of your lists. Links work for anyone, on letsee or not.</p>
        </div>
      ) : (
        <ul className="flex flex-col">
          {data.map((l) => (
            <Row key={l.token} link={l} onStopped={() => void mutate()} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Row({ link, onStopped }: { link: MyLink; onStopped: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const state = linkState(link);
  const href = link.kind === "list" && link.listId ? listPath(link.listId, link.itemName) : titlePath(link.itemType, link.itemId, link.itemName);
  const what = link.kind === "list" ? "A list" : link.kind === "viewing" ? "A night" : "A pass";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(passLinkUrl(link.token));
      toast.success("Link copied.");
    } catch {
      toast.error(`Couldn't copy. The link is ${passLinkUrl(link.token)}`);
    }
  };
  const stop = async () => {
    setBusy(true);
    const ok = await revokeShareLink(link.token);
    setBusy(false);
    setConfirming(false);
    if (!ok) {
      toast.error("That didn't save. Check your connection.");
      return;
    }
    toast.success("Stopped. Whoever has it will see that it ran out.");
    onStopped();
  };

  return (
    <li className={`flex gap-4 border-b border-line py-4 last:border-b-0 ${state.live ? "" : "opacity-60"}`}>
      <Link href={href} className="shrink-0">
        {link.kind === "list" ? (
          <span className="flex aspect-2/3 w-16 items-center justify-center rounded-media bg-hover text-ink-500">
            <ListIcon className="size-6" aria-hidden />
          </span>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={getPosterUrl(link.imageUrl, "w185")} alt="" loading="lazy" className="aspect-2/3 w-16 rounded-media object-cover ring-1 ring-inset ring-line" />
        )}
      </Link>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-xs uppercase tracking-wide text-accent">{what}</p>
        <Link href={href} className="block truncate font-display text-lg text-ink-0 hover:underline hover:underline-offset-4">
          {link.itemName}
        </Link>
        {link.note && <p className="mt-0.5 line-clamp-2 font-display text-base italic text-ink-400">“{link.note}”</p>}
        <p className="mt-1 font-mono text-xs uppercase tracking-wide text-ink-500">{state.line}</p>
        {state.live && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void copy()} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium text-ink-200 ring-1 ring-inset ring-line-input hover:bg-hover hover:text-ink-0">
              <Copy className="size-4" aria-hidden />
              Copy link
            </button>
            {confirming ? (
              <>
                <button type="button" onClick={() => void stop()} disabled={busy} className="inline-flex h-9 items-center rounded-full bg-danger-fill px-3.5 text-sm font-semibold text-white disabled:opacity-60">
                  {busy ? "Stopping…" : "Stop it for good"}
                </button>
                <button type="button" onClick={() => setConfirming(false)} className="text-sm text-ink-500 hover:text-ink-0">
                  Keep it
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirming(true)} className="inline-flex h-9 items-center rounded-full px-3.5 text-sm font-medium text-ink-400 hover:bg-hover hover:text-danger">
                Stop this link
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
