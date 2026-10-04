"use client";

import { useState } from "react";
import useSWR from "swr";
import toast from "react-hot-toast";
import { supabase } from "@/utils/supabase/client";
import Avatar from "@components/ui/Avatar";
import Link from "@components/ui/AppLink";
import { Section, Toggle, useSaver } from "./Field";

export type PrivacyRow = {
  visibility: "public" | "followers" | "private";
  profile_show_ratings: boolean;
  profile_show_public_reviews: boolean;
};

const WHO: { value: PrivacyRow["visibility"]; label: string; help: string }[] = [
  { value: "public", label: "Anyone", help: "Anyone on letsee can open your profile." },
  { value: "followers", label: "People who follow you", help: "Everyone else sees your name and picture, and can ask to follow you." },
  { value: "private", label: "Only you", help: "Nobody else can open your profile." },
];

type Blocked = { id: string; username: string | null; avatar_url: string | null };

/** Who you've blocked: your own `user_blocks` rows, readable and removable under RLS. */
async function fetchBlocked(me: string): Promise<Blocked[]> {
  const { data: rows, error } = await supabase.from("user_blocks").select("blocked_id").eq("blocker_id", me);
  if (error) throw error;
  const ids = (rows ?? []).map((r) => r.blocked_id as string);
  if (!ids.length) return [];
  const { data: people } = await supabase.from("users").select("id, username, avatar_url").in("id", ids);
  const byId = new Map((people ?? []).map((p) => [p.id as string, p as Blocked]));
  return ids.map((id) => byId.get(id) ?? { id, username: null, avatar_url: null });
}

/**
 * Privacy: who sees you, what of yours they see, and who you've blocked. Each
 * choice saves the moment it's made. The old "show your diary" switch is gone:
 * it governed private notes, which nobody but you has been able to read since
 * migration 076, so it promised a control over nothing.
 */
export default function PrivacySection({ me, initial, onSaved }: { me: string; initial: PrivacyRow; onSaved: (patch: Partial<PrivacyRow>) => void }) {
  const { state, run } = useSaver();
  const [values, setValues] = useState<PrivacyRow>(initial);

  const save = async (patch: Partial<PrivacyRow>) => {
    // Only what this change touched goes back if it fails: a snapshot of the
    // whole section would also undo another change that saved meanwhile.
    const before = Object.fromEntries(Object.keys(patch).map((k) => [k, values[k as keyof PrivacyRow]])) as Partial<PrivacyRow>;
    setValues((cur) => ({ ...cur, ...patch }));
    const ok = await run(async () => {
      const { data, error } = await supabase
        .from("users")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", me)
        .select("id");
      return error || !data?.length ? "That didn't save. Try again." : null;
    });
    if (ok) onSaved(patch);
    else setValues((cur) => ({ ...cur, ...before }));
  };

  const { data: blocked, mutate } = useSWR(["blocked", me], () => fetchBlocked(me), { revalidateOnFocus: false });
  const unblock = async (p: Blocked) => {
    await mutate((cur) => (cur ?? []).filter((x) => x.id !== p.id), { revalidate: false });
    const { error } = await supabase.from("user_blocks").delete().eq("blocker_id", me).eq("blocked_id", p.id);
    if (error) {
      toast.error("That didn't save. Try again.");
      void mutate();
      return;
    }
    toast.success(p.username ? `Unblocked ${p.username}` : "Unblocked");
  };

  return (
    <Section id="privacy" title="Privacy" state={state}>
      {/* Native radios: the fieldset's legend names the group, and arrow keys
          move between the choices as they do in any form. */}
      <fieldset disabled={state.kind === "saving"}>
        <legend className="mb-2 text-sm font-medium text-ink-200">Who can see your profile</legend>
        <div className="grid gap-2">
          {WHO.map((w) => {
            const on = values.visibility === w.value;
            return (
              <label
                key={w.value}
                className={`flex cursor-pointer items-start gap-3 rounded-control px-3.5 py-3 ring-1 ring-inset transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus ${
                  on ? "bg-action/10 ring-accent" : "ring-line-input hover:bg-hover"
                }`}
              >
                <input
                  type="radio"
                  name="profile-visibility"
                  value={w.value}
                  checked={on}
                  onChange={() => void save({ visibility: w.value })}
                  className="mt-1 size-4 shrink-0 accent-[var(--color-accent)]"
                />
                <span>
                  <span className="block text-base text-ink-0">{w.label}</span>
                  <span className="block text-sm text-ink-500">{w.help}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-1 border-t border-line pt-4">
        <Toggle
          label="Show your stars"
          help="Your ratings on your profile and in your stats. Off, visitors see what you watched but not what you thought of it."
          on={values.profile_show_ratings}
          onChange={(on) => void save({ profile_show_ratings: on })}
        />
        <Toggle
          label="Show your reviews"
          help="Words you've chosen to share, on your profile and on the title's page."
          on={values.profile_show_public_reviews}
          onChange={(on) => void save({ profile_show_public_reviews: on })}
        />
      </div>

      <div className="border-t border-line pt-4">
        <h3 className="text-sm font-medium text-ink-200">Blocked</h3>
        {!blocked ? (
          <div className="mt-3 h-10 rounded-control bg-hover" aria-hidden />
        ) : blocked.length === 0 ? (
          <p className="mt-1 text-sm text-ink-500">Nobody. Block someone from the menu on their profile; they won&apos;t be told.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {blocked.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2">
                <Avatar src={p.avatar_url} name={p.username ?? "?"} size={32} />
                {p.username ? (
                  <Link href={`/app/profile/${encodeURIComponent(p.username)}`} className="min-w-0 flex-1 truncate text-base text-ink-0 hover:underline">
                    {p.username}
                  </Link>
                ) : (
                  <span className="min-w-0 flex-1 text-base text-ink-500">A closed account</span>
                )}
                <button
                  type="button"
                  onClick={() => void unblock(p)}
                  className="h-9 shrink-0 rounded-full px-3.5 text-sm font-medium text-ink-200 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover hover:text-ink-0"
                >
                  Unblock
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}
