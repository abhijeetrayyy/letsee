"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import toast from "react-hot-toast";
import Link from "@components/ui/AppLink";
import Avatar from "@components/ui/Avatar";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import { findPerson } from "@/lib/db/rooms";
import { cleanInviter, cleanToken, inviteUrl, rememberInviter, rememberPassToken } from "@/lib/people/invite";
import { claimShareLink, openShareLink, openSharedListItems } from "@/lib/db/shareLinks";
import { getPosterUrl } from "@/utils/imageUrl";
import { titlePath } from "@/utils/urls";
import { fetchLoves } from "@/lib/db/favourites";

const primary = "inline-flex h-12 items-center justify-center rounded-full bg-action px-6 text-base font-semibold text-on-action transition-colors hover:bg-action-hover";
const quiet = "inline-flex h-12 items-center justify-center rounded-full px-6 text-base font-medium text-ink-200 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover hover:text-ink-0";

/** Someone's invitation: a person (`?from=`) or a pass by link (`?t=`). */
export default function InviteDoor() {
  const params = useSearchParams();
  const token = cleanToken(params.get("t"));
  if (params.get("t") !== null) return <PassDoor token={token} />;
  return <PersonDoor />;
}

/**
 * A link (migrations 108, 109): a pass to keep, a night from someone's diary,
 * or one of their lists. Each shows only what `open_share_link` returns —
 * nothing at all for a link that was stopped, ran out or never existed — and
 * the one action that answers it.
 */
function PassDoor({ token }: { token: string | null }) {
  const { user, status } = useAuth();
  const { data: link, isLoading } = useSWR(token ? ["share-link", token] : null, () => openShareLink(token), { revalidateOnFocus: false });
  const { data: items } = useSWR(token && link?.kind === "list" ? ["share-link-items", token] : null, () => openSharedListItems(token), { revalidateOnFocus: false });
  const [state, setState] = useState<"idle" | "keeping" | "kept">("idle");

  // Signed out: remember who sent it (and a pass, so joining keeps it).
  // Only once we know they're signed out — while the session is still being
  // read, remembering would let the shell keep the pass without a tap.
  useEffect(() => {
    if (!link || !token || status !== "anon") return;
    if (link.kind === "pass") rememberPassToken(token);
    rememberInviter(link.from.username);
  }, [link, token, status]);

  if (!token || (!isLoading && !link)) {
    return (
      <Door>
        <h1 className="text-4xl leading-tight text-ink-0">This link has run out.</h1>
        <p className="text-base text-ink-400">Links last thirty days, and whoever sent it can switch it off. Ask them for a fresh one.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link href="/signup" className={primary}>
            Start on your own
          </Link>
        </div>
      </Door>
    );
  }
  if (!link) return <Door>{null}</Door>;

  const own = status === "ok" && user?.username === link.from.username;
  const keep = async () => {
    setState("keeping");
    const result = await claimShareLink(token);
    if (result === "kept") {
      setState("kept");
      return;
    }
    setState("idle");
    toast.error(result === "yours" ? "That's your own link." : result === "gone" ? "This link has run out." : "That didn't save. Check your connection.");
  };
  const joinOrOpen =
    status === "ok" ? null : (
      <>
        <Link href={`/signup?invite=${encodeURIComponent(link.from.username)}`} className={primary}>
          Join {link.from.username}
        </Link>
        <Link href={`/login?next=${encodeURIComponent(`/invite?t=${token}`)}`} className={quiet}>
          I have an account
        </Link>
      </>
    );
  const poster = link.kind === "list" ? (items?.[0]?.imageUrl ?? null) : link.imageUrl;
  const sentBy = (verb: string) => (
    <div className="flex items-center gap-2 text-sm text-ink-300">
      <Avatar src={link.from.avatarUrl} name={link.from.username} size={28} />
      <span>
        <span className="font-medium text-ink-0">{link.from.username}</span> {verb}
      </span>
    </div>
  );

  return (
    <div className="w-full">
      <section data-theme="dark" className="relative isolate flex min-h-dvh items-center overflow-hidden bg-page">
        {poster && (
          <div aria-hidden className="absolute inset-0 -z-10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={getPosterUrl(poster, "w342")} alt="" className="absolute inset-0 h-full w-full scale-125 object-cover opacity-60" style={{ filter: "blur(64px) saturate(1.5)" }} />
            <div className="absolute inset-0 bg-linear-to-b from-page/30 via-page/60 to-page" />
          </div>
        )}
        <div className="mx-auto flex w-full max-w-read flex-col items-center gap-6 px-4 py-16 text-center">
          {link.kind === "list" ? (
            <>
              {sentBy("made a list for you to see")}
              <h1 className="text-4xl leading-tight text-ink-0 sm:text-5xl">{link.listName}</h1>
              {link.listDescription && <p className="max-w-sheet font-display text-xl italic text-ink-300">{link.listDescription}</p>}
              <p className="font-mono text-xs uppercase tracking-wide text-ink-400">
                {link.listCount} {link.listCount === 1 ? "title" : "titles"}
              </p>
              {items && items.length > 0 && (
                <ul className="grid w-full grid-cols-3 gap-3 text-left sm:grid-cols-4">
                  {items.map((t) => (
                    <li key={`${t.itemType}:${t.itemId}`} className="min-w-0">
                      <Link href={titlePath(t.itemType, t.itemId, t.itemName)} className="group block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={getPosterUrl(t.imageUrl, "w185")} alt="" loading="lazy" className="aspect-2/3 w-full rounded-media object-cover ring-1 ring-inset ring-line-strong transition-opacity group-hover:opacity-90" />
                        <span className="mt-1.5 block truncate text-xs text-ink-300">{t.itemName}</span>
                      </Link>
                      {t.note && <p className="mt-1 line-clamp-3 font-display text-xs italic leading-snug text-ink-400">“{t.note}”</p>}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={getPosterUrl(link.imageUrl, "w342")} alt="" className="img-fade aspect-2/3 w-44 rounded-media object-cover shadow-2xl ring-1 ring-inset ring-line-strong sm:w-52" />
              {link.kind === "pass" ? sentBy("passed you") : sentBy(link.rewatch ? "watched this again" : "watched this")}
              <h1 className="text-4xl leading-tight text-ink-0 sm:text-5xl">{link.itemName}</h1>
              {link.kind === "pass" && link.note && <p className="max-w-sheet font-display text-2xl italic leading-snug text-ink-0">“{link.note}”</p>}
              {link.kind === "viewing" && (
                <p className="font-mono text-xs uppercase tracking-wide text-ink-300">
                  {[
                    new Date(`${link.watchedOn}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" }),
                    link.place === "cinema" ? "at the cinema" : null,
                    link.company > 0 ? `with ${link.company} ${link.company === 1 ? "other" : "others"}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </>
          )}

          <div className="flex flex-wrap justify-center gap-2">
            {own ? (
              <p className="text-sm text-ink-400">This is your link. Send it to someone.</p>
            ) : link.kind === "pass" && status === "ok" ? (
              state === "kept" ? (
                <Link href="/app/up-next" className={primary}>
                  It&apos;s in Up next, from {link.from.username}
                </Link>
              ) : (
                <button type="button" onClick={() => void keep()} disabled={state === "keeping"} className={primary}>
                  {state === "keeping" ? "Keeping it…" : "Keep it in Up next"}
                </button>
              )
            ) : status === "ok" ? (
              <Link href={`/app/profile/${encodeURIComponent(link.from.username)}`} className={primary}>
                See {link.from.username}&apos;s films
              </Link>
            ) : (
              joinOrOpen
            )}
          </div>
          {link.kind !== "list" && (
            <Link href={titlePath(link.itemType, link.itemId, link.itemName)} className="text-sm text-ink-400 underline decoration-line-input underline-offset-4 hover:text-ink-0">
              What is it?
            </Link>
          )}
          {status !== "ok" && (
            <p className="max-w-sheet text-sm text-ink-500">
              letsee keeps the films you watch and the people you watch them with.
              {link.kind === "pass" ? ` Join, and this one waits for you in Up next, from ${link.from.username}.` : ` Join, and ${link.from.username} is the first person you meet.`}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

/** Someone's invitation to watch films with them, with the one action that answers it. */
function PersonDoor() {
  const params = useSearchParams();
  const from = cleanInviter(params.get("from"));
  const { user, status } = useAuth();
  const { data: person, isLoading } = useSWR(from ? ["invite-person", from.toLowerCase()] : null, () => findPerson(from!), { revalidateOnFocus: false });
  // What they love: the quickest way to know whether you'd watch well together.
  const { data: loves } = useSWR(person ? ["invite-loves", person.id] : null, () => fetchLoves(person!.id), { revalidateOnFocus: false });
  const [copied, setCopied] = useState(false);

  // Remember who sent you, so sign-up can say so and they are the first person you meet.
  useEffect(() => {
    if (person?.username && status !== "ok") rememberInviter(person.username);
  }, [person?.username, status]);

  if (!from || (!isLoading && !person)) {
    return (
      <Door>
        <h1 className="text-4xl leading-tight text-ink-0">This invitation is missing its person.</h1>
        <p className="text-base text-ink-400">Ask whoever sent it for the link again, or start on your own.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link href="/signup" className={primary}>
            Start
          </Link>
        </div>
      </Door>
    );
  }
  if (!person) return <Door>{null}</Door>;

  const own = status === "ok" && user?.id === person.id;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl(person.username));
      setCopied(true);
    } catch {
      toast.error("Couldn't copy. Copy the address bar instead.");
    }
  };

  return (
    <Door>
      <Avatar src={person.avatarUrl} name={person.username} size={88} />
      <h1 className="text-4xl leading-tight text-ink-0 sm:text-5xl">
        {own ? "This is your invitation." : `${person.username} wants to watch films with you.`}
      </h1>
      <p className="max-w-sheet text-base leading-relaxed text-ink-400">
        {own
          ? "Send it to someone you watch with. When they join, your room with them is waiting."
          : "letsee keeps the films you watch, and the people you watch them with. Log what you saw together, pass each other films, decide tonight’s."}
      </p>
      {!own && loves && loves.length >= 2 && (
        <figure className="w-full max-w-sheet">
          <ul className="grid grid-cols-4 gap-2.5">
            {loves.map((l) => (
              <li key={l.key}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getPosterUrl(l.imageUrl, "w185")} alt={l.itemName} className="aspect-2/3 w-full rounded-media bg-hover object-cover ring-1 ring-inset ring-line-strong" />
              </li>
            ))}
          </ul>
          <figcaption className="mt-2 text-sm text-ink-500">Some of what {person.username} loves</figcaption>
        </figure>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        {own ? (
          <button type="button" onClick={copy} className={primary}>
            {copied ? "Copied" : "Copy the link"}
          </button>
        ) : status === "ok" ? (
          <Link href={`/app/people/${encodeURIComponent(person.username)}`} className={primary}>
            Open your room with {person.username}
          </Link>
        ) : (
          <>
            <Link href={`/signup?invite=${encodeURIComponent(person.username)}`} className={primary}>
              Join {person.username}
            </Link>
            <Link href={`/login?next=${encodeURIComponent(`/app/people/${person.username}`)}`} className={quiet}>
              I have an account
            </Link>
          </>
        )}
      </div>
    </Door>
  );
}

function Door({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-read flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      {children}
    </div>
  );
}
