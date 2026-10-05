"use client";

import { useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Download, FileJson, FileSpreadsheet, ShieldCheck, Upload } from "lucide-react";
import Link from "@components/ui/AppLink";
import { supabase } from "@/utils/supabase/client";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import { Labeled, Section, inputClass } from "./Field";

const row = "flex items-start gap-4 rounded-control p-3 -mx-3 transition-colors hover:bg-hover";

/**
 * Your data (was `/app/data`): the two exports, the importers, and what
 * happens to what you put here, in ordinary words — portability is a trust
 * question, answered with buttons that work (WHY_PEOPLE_COME_BACK.md Bet 11).
 */
export function DataSection() {
  const { user } = useAuth();
  const me = user?.id ?? null;
  // When each download was last taken (migration 121), so the row can say
  // when the next is ready instead of letting the button fail.
  const { data: quotas, mutate } = useSWR(me ? ["usage-quotas", me] : null, async () => {
    const { data } = await supabase.from("usage_quotas").select("action, last_at");
    return new Map((data ?? []).map((q) => [q.action as string, q.last_at as string]));
  }, { revalidateOnFocus: false });
  return (
    <Section id="your-data" title="Your data" hint="Everything you log here is yours. Take it with you — each download once every 15 days.">
      <ExportRow
        href="/api/account/export/letterboxd"
        lastAt={quotas?.get("export_letterboxd") ?? null}
        onDone={() => void mutate()}
        icon={<FileSpreadsheet className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />}
        title="Diary as CSV, for Letterboxd"
        body="One row per viewing, rewatches included, with the date, your rating and your private notes. Films only; Letterboxd has no series."
      />
      <ExportRow
        href="/api/account/export"
        lastAt={quotas?.get("export_json") ?? null}
        onDone={() => void mutate()}
        icon={<FileJson className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />}
        title="Everything, as JSON"
        body="Your profile, library, viewings, ratings, notes, lists and who you follow, in a file any program can read."
      />
      <Link href="/app/import" className={row}>
        <Upload className="mt-0.5 size-5 shrink-0 text-ink-300" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-ink-0">Bring your history in</span>
          <span className="mt-0.5 block text-sm text-ink-500">From Letterboxd, Trakt, TV Time, Simkl, IMDb or Netflix. Nothing already here is overwritten.</span>
        </span>
      </Link>

      <div className="border-t border-line pt-4">
        <p className="flex items-center gap-2 font-semibold text-ink-0">
          <ShieldCheck className="size-5 text-accent" aria-hidden /> What we do with it
        </p>
        <ul className="mt-3 grid gap-2 text-sm leading-relaxed text-ink-400">
          <li>Your diary, ratings and notes are never sold, never used to train anything, and never shown to anyone your privacy settings don&apos;t allow.</li>
          <li>A private note stays private. Sharing your words is a separate thing you do, on purpose, one piece of writing at a time.</li>
          <li>Nothing is deleted for you. A title leaves your library when you remove it; your account goes only when you ask, after thirty days.</li>
          <li>Export is free and always will be — each kind once every 15 days, because putting everything together is the heaviest thing anyone can ask of the site.</li>
          <li>
            Film and series data come from{" "}
            <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer" className="underline decoration-line-input underline-offset-4 hover:text-ink-0">
              TMDB
            </a>
            , where to watch from JustWatch via TMDB. letsee uses the TMDB API but is not endorsed or certified by TMDB.
          </li>
        </ul>
      </div>
    </Section>
  );
}

const EXPORT_EVERY_DAYS = 15;

/**
 * One download. Fetched rather than linked, so a refusal is a sentence on the
 * row ("Your next one is ready on 20 October") and not a page of JSON; the
 * file is handed to the browser as a download once it's here.
 */
function ExportRow({ href, lastAt, onDone, icon, title, body }: { href: string; lastAt: string | null; onDone: () => void; icon: React.ReactNode; title: string; body: string }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const nextAt = lastAt ? new Date(Date.parse(lastAt) + EXPORT_EVERY_DAYS * 864e5) : null;
  const waiting = nextAt && nextAt.getTime() > Date.now() ? nextAt : null;
  const day = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long" });

  const download = async () => {
    if (busy || waiting) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(href);
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        setNote(payload?.error ?? "Couldn't prepare your download. Try again in a moment.");
        return;
      }
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "letsee-export";
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setNote("Couldn't reach letsee. Check your connection and try again.");
    } finally {
      setBusy(false);
      onDone();
    }
  };

  return (
    <button type="button" onClick={download} disabled={busy || !!waiting} className={`${row} w-full text-left disabled:cursor-not-allowed disabled:hover:bg-transparent`}>
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-ink-0">{title}</span>
        <span className="mt-0.5 block text-sm text-ink-500">{body}</span>
        {(waiting || busy || note) && (
          <span role="status" className={`mt-1.5 block text-sm ${note ? "text-danger" : "text-ink-300"}`}>
            {busy ? "Putting it together…" : note ?? `Downloaded on ${day(new Date(lastAt!))}. Your next one is ready on ${day(waiting!)}.`}
          </span>
        )}
      </span>
      <Download className={`mt-1 size-4 shrink-0 ${waiting ? "text-ink-600" : "text-ink-500"}`} aria-hidden />
    </button>
  );
}

/**
 * Account: the address you sign in with, and leaving. Deleting asks for your
 * password — the route re-authenticates on the server, so an unlocked laptop
 * can't schedule someone's account for deletion — and is the one typed
 * confirmation in the product (PAGES.md §7).
 */
export function AccountSection({ email }: { email: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload?.error || "Couldn't delete your account.");
        return;
      }
      // The route signed the session out on the server; clear this one too.
      await supabase.auth.signOut().catch(() => {});
      toast.success(payload?.message || "Your account will be deleted in 30 days.");
      router.replace("/login?status=account-deleted");
    } catch {
      setError("Couldn't reach letsee. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section id="account" title="Account">
      <div>
        <p className="text-sm font-medium text-ink-200">Signed in as</p>
        <p className="mt-0.5 break-all text-base text-ink-0">{email || "—"}</p>
      </div>

      <div className="border-t border-line pt-4">
        <p className="text-sm font-medium text-ink-200">Delete your account</p>
        <p className="mt-1 text-sm text-ink-500">
          Your account closes straight away, and is erased after 30 days. Signing back in before then brings everything back as it was.
        </p>
        {/* What happens, said plainly, including to other people — it was one
            line that left out the half that touches anyone else
            (migration 119 decides each of these). */}
        <ul className="mt-3 grid gap-1.5 text-sm text-ink-400">
          <li><span className="font-medium text-ink-200">Straight away,</span> your profile, lists and comments disappear for everyone, and nobody can message, follow or pass you a film.</li>
          <li><span className="font-medium text-ink-200">After 30 days,</span> your diary, ratings, favourites, lists, words and conversations are erased for good, along with your email and password.</li>
          <li><span className="font-medium text-ink-200">What others keep:</span> a group you started passes to its longest-standing member, a list others help keep passes to them, and replies to your comments stay, under &ldquo;This comment was deleted&rdquo;.</li>
        </ul>
        {!open ? (
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              setPassword("");
              setError("");
            }}
            className="mt-3 h-10 rounded-full px-4 text-sm font-medium text-danger ring-1 ring-inset ring-danger/50 transition-colors hover:bg-danger/10"
          >
            Delete my account…
          </button>
        ) : (
          <form onSubmit={confirm} className="mt-3 grid gap-3 rounded-control bg-danger/5 p-4 ring-1 ring-inset ring-danger/30">
            <Labeled id="settings-delete-password" label="Your password, to confirm">
              <input
                id="settings-delete-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
                aria-invalid={!!error}
                aria-describedby={error ? "settings-delete-error" : undefined}
                className={inputClass}
              />
            </Labeled>
            {error && (
              <p id="settings-delete-error" role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={busy || !password}
                className="h-10 rounded-full bg-danger-fill px-4 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
              >
                {busy ? "Closing your account…" : "Delete my account"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                className="h-10 rounded-full px-4 text-sm font-medium text-ink-200 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover"
              >
                Keep it
              </button>
            </div>
          </form>
        )}
      </div>
    </Section>
  );
}
