"use client";

import { use, useMemo, useState } from "react";
import useSWR from "swr";
import toast from "react-hot-toast";
import { ArrowLeft, CalendarClock, LoaderCircle } from "lucide-react";
import Link from "@components/ui/AppLink";
import Avatar from "@components/ui/Avatar";
import Faces from "@components/ds/Faces";
import Comments from "@components/social/Comments";
import { WeekList } from "@components/home/v2/parts";
import { swrFetcher } from "@/utils/swrFetcher";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import { fetchPeopleActivity } from "@/lib/db/peopleActivity";
import { groupWeek } from "@/lib/people/home";
import type { RoomPerson } from "@/lib/db/rooms";
import { getPosterUrl } from "@/utils/imageUrl";
import { titlePath } from "@/utils/urls";

/**
 * A group room (docs/design/RETHINK.md §5; clubs became rooms in migration
 * 107): the people you watch with in threes and fours. Who's in it, the
 * week's pick, what the group has been watching, *Decide tonight* with all of
 * them, and the group's talk. `/app/clubs/:slug` redirects here.
 */
type Member = { userId: string; username: string; avatarUrl: string | null; role: string };
type Pick = { id: number; item_id: string; item_type: string; title: string; image_url: string | null; note: string | null; ends_at: string };
type GroupData = {
  club: { id: number; slug: string; name: string; description: string | null; member_count: number };
  members: Member[];
  pick: Pick | null;
  isMember: boolean;
  membership?: string;
  isAdmin: boolean;
};

function daysLeft(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "ended";
  const days = Math.ceil(ms / 86400000);
  return days === 1 ? "1 day left" : `${days} days left`;
}

export default function GroupRoomPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { user, isAuthenticated } = useAuth();
  const me = user?.id ?? null;
  const { data, isLoading, mutate } = useSWR<GroupData>(`/api/clubs/${slug}`, swrFetcher);
  const [busy, setBusy] = useState(false);

  const members = useMemo(() => data?.members ?? [], [data]);
  const ids = members.map((m) => m.userId);
  const { data: activity } = useSWR(ids.length ? ["group-activity", slug, ids.join(",")] : null, () => fetchPeopleActivity(ids, 30), { revalidateOnFocus: false });
  const people = useMemo(() => new Map<string, RoomPerson>(members.map((m) => [m.userId, { id: m.userId, username: m.username, avatarUrl: m.avatarUrl }])), [members]);
  const lately = activity ? groupWeek(activity.viewings).slice(0, 10) : [];

  const toggleMembership = async () => {
    if (!data || busy) return;
    setBusy(true);
    const joined = data.isMember || data.membership === "pending";
    const res = await fetch(`/api/clubs/${slug}/members`, { method: joined ? "DELETE" : "POST" }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      toast.error("That didn't save. Check your connection.");
      return;
    }
    void mutate();
  };

  const invite = async () => {
    const url = `${window.location.origin}/app/people/g/${slug}`;
    const text = `Come and watch with ${data?.club.name ?? "us"} on letsee.`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: data?.club.name ?? "letsee", text, url });
        return;
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied. Send it to whoever should be in it.");
    } catch {
      toast.error(`Couldn't copy. The link is ${url}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoaderCircle className="size-5 animate-spin text-ink-500" aria-hidden />
      </div>
    );
  }
  if (!data?.club) {
    return (
      <div className="mx-auto flex w-full max-w-read flex-col items-start gap-4 px-4 py-16">
        <h1 className="text-2xl text-ink-0">That group doesn&apos;t exist.</h1>
        <Link href="/app/people" className="text-sm font-medium text-accent underline decoration-line-input underline-offset-4">
          Back to People
        </Link>
      </div>
    );
  }

  const { club, pick, isMember } = data;
  const pending = data.membership === "pending";
  const faces = members.map((m) => ({ username: m.username, avatarUrl: m.avatarUrl }));
  const primary = "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-action px-5 text-sm font-semibold text-on-action transition-colors hover:bg-action-hover disabled:opacity-60";
  const quiet = "inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium text-ink-0 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover disabled:opacity-60";

  return (
    <div className="w-full pb-16">
      {/* The group, on a dark band lit by what it's watching. */}
      <header data-theme="dark" className="relative isolate overflow-hidden bg-page">
        {pick?.image_url && (
          <div aria-hidden className="absolute inset-0 -z-10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={getPosterUrl(pick.image_url, "w342")} alt="" className="absolute inset-0 h-full w-full scale-125 object-cover opacity-60" style={{ filter: "blur(64px) saturate(1.5)" }} />
            <div className="absolute inset-0 bg-linear-to-b from-page/20 via-page/50 to-page" />
          </div>
        )}
        <div className="mx-auto flex max-w-app flex-col gap-5 px-4 pb-10 pt-8 sm:px-6 sm:pt-12 lg:px-8">
          <Link href="/app/people" className="inline-flex items-center gap-1.5 self-start text-sm text-ink-400 hover:text-ink-0">
            <ArrowLeft className="size-4" aria-hidden />
            People
          </Link>
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-accent">A group · {club.member_count} {club.member_count === 1 ? "person" : "people"}</p>
            <h1 className="mt-2 text-4xl leading-tight text-ink-0 sm:text-6xl">{club.name}</h1>
            {club.description && <p className="mt-3 max-w-read font-display text-xl italic text-ink-300">{club.description}</p>}
          </div>
          {faces.length > 0 && (
            <div className="flex items-center gap-3">
              <Faces people={faces} size={40} max={8} />
              <span className="text-sm text-ink-300">
                {members.slice(0, 3).map((m) => m.username).join(", ")}
                {members.length > 3 ? ` and ${members.length - 3} more` : ""}
              </span>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {isMember && (
              <Link href={`/app/tonight?club=${encodeURIComponent(club.slug)}`} className={primary}>
                Decide tonight
              </Link>
            )}
            {isAuthenticated ? (
              <button type="button" onClick={toggleMembership} disabled={busy} className={isMember || pending ? quiet : primary}>
                {busy ? "…" : isMember ? "Leave" : pending ? "Asked to join" : "Join"}
              </button>
            ) : (
              <Link href={`/login?next=${encodeURIComponent(`/app/people/g/${club.slug}`)}`} className={primary}>
                Sign in to join
              </Link>
            )}
            {isMember && (
              <button type="button" onClick={() => void invite()} className={quiet}>
                Invite someone
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-app gap-12 px-4 pt-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16 lg:px-8">
        <div className="flex min-w-0 flex-col gap-12">
          <section aria-labelledby="pick">
            <h2 id="pick" className="mb-4 text-2xl text-ink-0 sm:text-3xl">
              This week&apos;s pick
            </h2>
            {pick ? (
              <Link href={titlePath(pick.item_type, pick.item_id, pick.title)} className="group flex gap-5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getPosterUrl(pick.image_url, "w342")} alt="" loading="lazy" className="img-fade aspect-2/3 w-32 shrink-0 rounded-media object-cover ring-1 ring-inset ring-line-strong sm:w-40" />
                <span className="min-w-0">
                  <span className="block font-display text-2xl text-ink-0 group-hover:underline group-hover:decoration-line-input group-hover:underline-offset-4">{pick.title}</span>
                  {pick.note && <span className="mt-1 block text-base text-ink-400">{pick.note}</span>}
                  <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-raised px-3 py-1 text-xs font-medium text-ink-300 ring-1 ring-inset ring-line-strong">
                    <CalendarClock className="size-3.5" aria-hidden />
                    {daysLeft(pick.ends_at)}
                  </span>
                </span>
              </Link>
            ) : (
              <p className="text-sm text-ink-500">No pick this week. An organiser sets one, and everyone watches it before it ends.</p>
            )}
          </section>

          {lately.length > 0 && (
            <section aria-labelledby="group-lately">
              <h2 id="group-lately" className="mb-4 text-2xl text-ink-0 sm:text-3xl">
                What the group has been watching
              </h2>
              <WeekList groups={lately} people={people} end={null} />
            </section>
          )}

          <section aria-labelledby="talk">
            <h2 id="talk" className="mb-4 text-2xl text-ink-0 sm:text-3xl">
              Talk
            </h2>
            <Comments itemId={String(club.id)} itemType="club" />
          </section>
        </div>

        <aside aria-labelledby="members">
          <h2 id="members" className="mb-3 text-xl text-ink-0">
            In the group
          </h2>
          <ul className="divide-y divide-line">
            {members.map((m) => (
              <li key={m.userId}>
                <Link href={`/app/profile/${encodeURIComponent(m.username)}`} className="flex items-center gap-3 py-2.5 hover:opacity-90">
                  <Avatar src={m.avatarUrl} name={m.username} size={40} />
                  <span className="min-w-0 flex-1 truncate text-base font-medium text-ink-0">{m.username}</span>
                  {m.role !== "member" && <span className="font-mono text-xs uppercase tracking-wide text-ink-500">{m.role}</span>}
                  {m.userId === me && <span className="text-xs text-ink-500">you</span>}
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
