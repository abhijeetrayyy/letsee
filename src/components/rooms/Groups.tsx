"use client";

import { useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { Plus, Users } from "lucide-react";
import Link from "@components/ui/AppLink";
import Sheet from "@components/ds/Sheet";
import { fetchClubs, fetchMyClubs } from "@/lib/db/social";

/**
 * Groups on People (clubs became group rooms, migration 107): the ones you're
 * in first, then a few you could join, and *Start a group*. A group opens at
 * `/app/people/g/[slug]`.
 */
export default function Groups({ me }: { me: string }) {
  const router = useRouter();
  const { data, mutate } = useSWR(["clubs", me], () => fetchClubs(me), { revalidateOnFocus: false });
  const { data: myClubs, mutate: mutateMine } = useSWR(["my-clubs", me], () => fetchMyClubs(me), { revalidateOnFocus: false });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [about, setAbout] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const mine = myClubs ?? [];
  const others = (data ?? []).filter((c) => !c.isMember).slice(0, 4);

  const create = async () => {
    if (name.trim().length < 3) {
      setError("Give the group a name of three letters or more.");
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch("/api/clubs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), description: about.trim() }),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    setSaving(false);
    if (!res?.ok || !body?.club?.slug) {
      setError(body?.error ?? "That didn't save. Check your connection.");
      return;
    }
    void mutate();
    void mutateMine();
    setOpen(false);
    router.push(`/app/people/g/${body.club.slug}`);
  };

  const row = (c: { slug: string; name: string; member_count: number; description: string | null }) => (
    <li key={c.slug}>
      <Link href={`/app/people/g/${c.slug}`} className="flex items-center gap-3 py-2.5 hover:opacity-90">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-hover text-ink-300">
          <Users className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-medium text-ink-0">{c.name}</span>
          <span className="block truncate text-sm text-ink-500">
            {c.member_count} {c.member_count === 1 ? "person" : "people"}
            {c.description ? ` · ${c.description}` : ""}
          </span>
        </span>
      </Link>
    </li>
  );

  return (
    <section aria-labelledby="groups" className="mt-10">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 id="groups" className="text-xl text-ink-0">
          Groups
        </h2>
        <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline hover:underline-offset-4">
          <Plus className="size-4" aria-hidden />
          Start a group
        </button>
      </div>
      {mine.length > 0 && <ul className="divide-y divide-line">{mine.map(row)}</ul>}
      {mine.length === 0 && <p className="text-sm text-ink-500">Watch with three or four people at once: a group has its own room, a weekly pick and Decide tonight for everyone in it.</p>}
      {others.length > 0 && (
        <>
          <p className="mt-4 text-xs font-medium text-ink-500">Groups you could join</p>
          <ul className="divide-y divide-line">{others.map(row)}</ul>
        </>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="Start a group" description="A room for the people you watch with together.">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
          className="flex flex-col gap-4"
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-0">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Sunday film night" className="h-11 rounded-control bg-raised px-3 text-base text-ink-0 ring-1 ring-inset ring-line-input placeholder:text-ink-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-0">What it&apos;s for (optional)</span>
            <input value={about} onChange={(e) => setAbout(e.target.value)} maxLength={160} placeholder="Horror, once a month, at Sam's" className="h-11 rounded-control bg-raised px-3 text-base text-ink-0 ring-1 ring-inset ring-line-input placeholder:text-ink-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus" />
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button type="submit" disabled={saving} className="inline-flex h-11 items-center justify-center rounded-full bg-action px-6 text-base font-semibold text-on-action hover:bg-action-hover disabled:opacity-60">
            {saving ? "Starting…" : "Start the group"}
          </button>
        </form>
      </Sheet>
    </section>
  );
}
