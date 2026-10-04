"use client";

import useSWR, { mutate as mutateGlobal } from "swr";
import toast from "react-hot-toast";
import Link from "@components/ui/AppLink";
import { supabase } from "@/utils/supabase/client";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import ServicePicker from "@components/tonight/ServicePicker";
import { ThemeSwitch } from "@components/ds/AccountMenu";
import ProfileSection, { type ProfileRow } from "./ProfileSection";
import PrivacySection, { type PrivacyRow } from "./PrivacySection";
import { AccountSection, DataSection } from "./DataSection";
import { Section } from "./Field";

/**
 * Settings (docs/design/PAGES.md §7; was `/app/profile/setup` and `/app/data`).
 *
 * One page of sections, each saving as it changes — there is no Save button
 * anywhere on it. Profile, Privacy, Services and region, Appearance, Your data,
 * Account. Read in the browser from your own row under RLS, so the page itself
 * is static. Your four and the people you'd follow anywhere are edited where
 * they're shown, on your profile, and this page says so rather than copying
 * the editor.
 *
 * Left out on purpose: notification settings (notifications are in-app only,
 * and only for something a person did — there is nothing to tune), and the
 * old page's featured list, pinned review, banner link and "show your diary"
 * switch, none of which the profile reads any more.
 */
type Loaded = { email: string; profile: ProfileRow; privacy: PrivacyRow };

async function load(me: string): Promise<Loaded> {
  // The session already in the browser, not getUser(): that is a round trip
  // to the auth server just to show an address we already hold.
  const [{ data: auth }, { data: row, error }] = await Promise.all([
    supabase.auth.getSession(),
    supabase
      .from("users")
      .select("username, tagline, about, avatar_url, visibility, profile_show_ratings, profile_show_public_reviews")
      .eq("id", me)
      .maybeSingle(),
  ]);
  if (error) throw error;
  const v = String(row?.visibility ?? "public").toLowerCase();
  return {
    email: auth.session?.user?.email ?? "",
    profile: {
      username: (row?.username as string) ?? "",
      tagline: (row?.tagline as string) ?? "",
      about: (row?.about as string) ?? "",
      avatar_url: (row?.avatar_url as string) ?? "",
    },
    privacy: {
      visibility: v === "followers" || v === "private" ? v : "public",
      profile_show_ratings: row?.profile_show_ratings ?? true,
      profile_show_public_reviews: row?.profile_show_public_reviews ?? true,
    },
  };
}

const SECTIONS = [
  ["profile", "Profile"],
  ["privacy", "Privacy"],
  ["services", "Services"],
  ["appearance", "Appearance"],
  ["your-data", "Your data"],
  ["account", "Account"],
] as const;

export default function SettingsClient() {
  const { user, status, refresh } = useAuth();
  const me = status === "ok" ? user?.id ?? null : null;
  const { data, error, mutate } = useSWR(me ? ["settings", me] : null, () => load(me!), { revalidateOnFocus: false });

  if (status === "anon") {
    return (
      <Page>
        <p className="text-base text-ink-400">Sign in to change your profile, your privacy and what you have to watch on.</p>
        <Link href="/login?next=/app/settings" className="mt-6 inline-flex h-11 items-center rounded-full bg-action px-5 font-semibold text-on-action hover:bg-action-hover">
          Sign in
        </Link>
      </Page>
    );
  }
  // Someone who hasn't finished onboarding has no profile row yet for these
  // fields to save into; the welcome steps create it.
  if (status === "needs_profile") {
    return (
      <Page>
        <p className="text-base text-ink-400">Pick your name first — your profile and its settings start there.</p>
        <Link href="/app/welcome" className="mt-6 inline-flex h-11 items-center rounded-full bg-action px-5 font-semibold text-on-action hover:bg-action-hover">
          Finish setting up
        </Link>
      </Page>
    );
  }
  // Only when there is nothing to show: a background refetch that fails keeps
  // the page (and anything typed into it) where it is.
  if (error && !data) {
    return (
      <Page>
        <p className="text-sm text-ink-400">
          Your settings didn&apos;t load.{" "}
          <button type="button" onClick={() => void mutate()} className="font-medium text-ink-0 underline decoration-line-input underline-offset-4">
            Try again
          </button>
        </p>
      </Page>
    );
  }
  if (!me || !data) {
    return (
      <Page>
        <div className="grid gap-4" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-48 rounded-card bg-raised" />
          ))}
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <nav aria-label="Settings sections" className="-mx-4 mb-10 flex gap-2 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:flex-wrap sm:px-0">
        {SECTIONS.map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-sm font-medium text-ink-300 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover hover:text-ink-0"
          >
            {label}
          </a>
        ))}
      </nav>

      <div className="grid gap-12">
        <ProfileSection
          me={me}
          initial={data.profile}
          onSaved={(patch) => void mutate((cur) => (cur ? { ...cur, profile: { ...cur.profile, ...patch } } : cur), { revalidate: false })}
          onRenamed={(name) => {
            void mutate((cur) => (cur ? { ...cur, profile: { ...cur.profile, username: name } } : cur), { revalidate: false });
            void refresh();
            toast.success(`You're ${name} now. Old links to your profile no longer work.`);
          }}
        />
        <PrivacySection
          me={me}
          initial={data.privacy}
          onSaved={(patch) => void mutate((cur) => (cur ? { ...cur, privacy: { ...cur.privacy, ...patch } } : cur), { revalidate: false })}
        />

        <Section id="services" title="Services and region" hint="So Tonight and New on your services only suggest what you can actually put on.">
          <ServicePicker
            bare
            onSaved={() => {
              toast.success("Saved");
              void mutateGlobal("/api/user/providers");
            }}
          />
        </Section>

        <Section id="appearance" title="Appearance" hint="On this device. Films are always shown on a dark screen.">
          <ThemeSwitch className="" />
        </Section>

        <Section id="taste" title="Taste">
          <p className="text-sm text-ink-400">
            Your four favourites and the people you&apos;d follow anywhere are edited where they&apos;re shown.{" "}
            {data.profile.username && (
              <Link href={`/app/profile/${encodeURIComponent(data.profile.username)}`} className="font-medium text-ink-0 underline decoration-line-input underline-offset-4">
                Open your profile
              </Link>
            )}
          </p>
        </Section>

        <DataSection />
        <AccountSection email={data.email} />
      </div>
    </Page>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-read px-4 pb-20 pt-6 sm:pt-10">
      <h1 className="mb-6 text-4xl text-ink-0">Settings</h1>
      {children}
    </div>
  );
}
