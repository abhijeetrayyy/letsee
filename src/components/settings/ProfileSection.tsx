"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase/client";
import Avatar from "@components/ui/Avatar";
import { Labeled, Section, inputClass, useSaver } from "./Field";

export type ProfileRow = {
  username: string;
  tagline: string;
  about: string;
  avatar_url: string;
};

const NAME_MIN = 2;
const NAME_MAX = 15;
const LINE_MAX = 80;
const BIO_MAX = 400;

export function cleanName(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9_]/g, "");
}

export function nameProblem(name: string): string | null {
  if (!name) return "Pick a name.";
  if (name.length < NAME_MIN) return `At least ${NAME_MIN} characters.`;
  if (name.length > NAME_MAX) return `At most ${NAME_MAX} characters.`;
  if (name === "null" || name === "undefined") return "That name isn't allowed.";
  return null;
}

/** A picture link is optional; when given it has to be a web address the page can load. */
export function urlProblem(url: string): string | null {
  if (!url) return null;
  if (!/^https:\/\/\S+$/i.test(url)) return "Use a full link starting with https://";
  if (url.length > 500) return "That link is too long.";
  return null;
}

/**
 * Profile: how you appear. Each field saves when you leave it, straight to
 * your own `users` row — not through `save_my_profile`, which keeps the old
 * value for anything left empty, so a bio could never be cleared. The name is
 * the one field that waits for a tap, because changing it changes your
 * address and every link to your profile.
 */
export default function ProfileSection({
  me,
  initial,
  onSaved,
  onRenamed,
}: {
  me: string;
  initial: ProfileRow;
  /** Keeps the page's cached copy in step, so coming back shows what was saved. */
  onSaved: (patch: Partial<ProfileRow>) => void;
  onRenamed: (name: string) => void;
}) {
  const { state, run } = useSaver();
  // What the database holds, to tell an edit from a value already saved.
  const [saved, setSaved] = useState<ProfileRow>(initial);
  const [values, setValues] = useState<ProfileRow>(initial);
  const set = (k: keyof ProfileRow, v: string) => setValues((cur) => ({ ...cur, [k]: v }));
  /**
   * A failed field keeps its own error under it until it saves: the section's
   * status is only the latest save, and a later one saving fine would
   * otherwise paper over text that never reached the database.
   */
  const [fieldError, setFieldError] = useState<Partial<Record<keyof ProfileRow, string>>>({});

  const saveField = async (k: Exclude<keyof ProfileRow, "username">) => {
    const value = values[k].trim();
    if (value === saved[k]) return;
    if (k === "avatar_url" && urlProblem(value)) return;
    const ok = await run(async () => {
      // `.select` so an update that matched no row is seen as one.
      const { data, error } = await supabase
        .from("users")
        .update({ [k]: value || null, updated_at: new Date().toISOString() })
        .eq("id", me)
        .select("id");
      return error || !data?.length ? "That didn't save. Try again." : null;
    });
    setFieldError((cur) => ({ ...cur, [k]: ok ? undefined : "This didn't save — leave the field again to retry." }));
    if (ok) {
      setSaved((cur) => ({ ...cur, [k]: value }));
      onSaved({ [k]: value });
    }
  };

  // The name: checked as you type, changed on a tap.
  const [availability, setAvailability] = useState<"unknown" | "checking" | "free" | "taken">("unknown");
  const name = values.username;
  const changed = name !== saved.username;
  const problem = changed ? nameProblem(name) : null;
  useEffect(() => {
    if (!changed || problem) return;
    let stale = false;
    const t = setTimeout(async () => {
      setAvailability("checking");
      const { data, error } = await supabase.from("users").select("id").eq("username", name).maybeSingle();
      if (!stale) setAvailability(error ? "unknown" : data && data.id !== me ? "taken" : "free");
    }, 400);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [name, changed, problem, me]);

  const rename = async () => {
    const ok = await run(async () => {
      const { data, error } = await supabase.from("users").update({ username: name, updated_at: new Date().toISOString() }).eq("id", me).select("id");
      if (error?.code === "23505") return "Someone just took that name. Try another.";
      return error || !data?.length ? "That didn't save. Try again." : null;
    });
    if (ok) {
      setSaved((cur) => ({ ...cur, username: name }));
      setAvailability("unknown");
      onRenamed(name);
    }
  };

  const nameStatus = !changed
    ? `Your profile is at /app/profile/${saved.username}`
    : problem ?? (availability === "checking" ? "Checking…" : availability === "taken" ? "Taken." : availability === "free" ? "Free — it's yours if you want it." : "");

  return (
    <Section id="profile" title="Profile" state={state}>
      <div className="flex items-center gap-4">
        <Avatar src={urlProblem(values.avatar_url) ? null : values.avatar_url || null} name={saved.username} size={64} />
        <p className="text-sm text-ink-500">How you appear to your people: your name, a line, a few words about you, and a picture.</p>
      </div>

      <Labeled id="settings-name" label="Your name" help={<span aria-live="polite">{nameStatus}</span>}>
        <div className="flex gap-2">
          <input
            id="settings-name"
            value={name}
            onChange={(e) => {
              setAvailability("unknown");
              set("username", cleanName(e.target.value));
            }}
            autoComplete="username"
            maxLength={NAME_MAX + 5}
            aria-invalid={changed && (!!problem || availability === "taken")}
            aria-describedby="settings-name-help"
            className={inputClass}
          />
          {changed && (
            <button
              type="button"
              onClick={rename}
              disabled={!!problem || availability !== "free" || state.kind === "saving"}
              className="shrink-0 rounded-full bg-action px-4 text-sm font-semibold text-on-action transition-colors hover:bg-action-hover disabled:opacity-50"
            >
              Use this name
            </button>
          )}
        </div>
      </Labeled>

      <Labeled id="settings-line" label="Your line" help={fieldError.tagline ?? `One line under your name. ${values.tagline.length}/${LINE_MAX}`} error={!!fieldError.tagline}>
        <input
          id="settings-line"
          value={values.tagline}
          onChange={(e) => set("tagline", e.target.value)}
          onBlur={() => void saveField("tagline")}
          maxLength={LINE_MAX}
          placeholder="Horror by night, rom-coms by day"
          aria-describedby="settings-line-help"
          className={inputClass}
        />
      </Labeled>

      <Labeled id="settings-bio" label="About you" help={fieldError.about ?? `${values.about.length}/${BIO_MAX}`} error={!!fieldError.about}>
        <textarea
          id="settings-bio"
          value={values.about}
          onChange={(e) => set("about", e.target.value)}
          onBlur={() => void saveField("about")}
          maxLength={BIO_MAX}
          rows={3}
          aria-describedby="settings-bio-help"
          className={`${inputClass} resize-y`}
        />
      </Labeled>

      <Labeled id="settings-photo" label="Picture" help={urlProblem(values.avatar_url) ?? fieldError.avatar_url ?? "A link to a square picture. Leave it empty for your initials."} error={!!urlProblem(values.avatar_url) || !!fieldError.avatar_url}>
        <input
          id="settings-photo"
          type="url"
          inputMode="url"
          value={values.avatar_url}
          onChange={(e) => set("avatar_url", e.target.value)}
          onBlur={() => void saveField("avatar_url")}
          placeholder="https://"
          aria-invalid={!!urlProblem(values.avatar_url)}
          aria-describedby="settings-photo-help"
          className={inputClass}
        />
      </Labeled>

      <p className="text-sm text-ink-500">
        The colour at the top of your profile comes from your first favourite film. Change your favourites on your profile to change it.
      </p>
    </Section>
  );
}
