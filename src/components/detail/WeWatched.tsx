"use client";
import { LIGHT, TOKENS_DARK, alpha } from "@/design/tokens";

import { useRef, useState } from "react";
import useSWR from "swr";
import { Download, Share2, Users } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import { supabase } from "@/utils/supabase/client";
import { getPosterUrl } from "@/utils/imageUrl";
import { formatStars } from "@/utils/ratingScale";
import { titlePath } from "@/utils/urls";
import { useInView } from "@/hooks/useInView";
import { exportNodeAsPng } from "@/utils/exportImage";

/**
 * "We watched Dune. You 8, Priya 6."
 *
 * The tracker's job is not to host the group chat; it is to produce the
 * thing that gets pasted into it. Wordle's grid spread because it was
 * spoiler-free, legible without the app, and about the person's experience —
 * so this is a card, not a link: two names, two scores, one poster, nothing
 * else. It exists only when the viewer and somebody they watched with (or
 * follow) both have a score for this title.
 *
 * Off-screen capture, ShareProfileCard's pattern: the card is rendered at a
 * fixed size out of view and html2canvas reads it. Inline rgba only inside
 * the capture target.
 */

type Other = { userId: string; username: string; avatarUrl: string | null; score: number };

export default function WeWatched({
  itemId,
  itemType,
  itemName,
  posterPath,
}: {
  itemId: string;
  itemType: "movie" | "tv";
  itemName: string;
  posterPath: string | null;
}) {
  const { user, ready } = useAuth();
  const viewerId = user?.id ?? null;
  const { ref, inView } = useInView<HTMLDivElement>();
  const cardRef = useRef<HTMLDivElement>(null);
  const [capturing, setCapturing] = useState(false);
  const [pick, setPick] = useState(0);

  const { data } = useSWR(viewerId && inView ? ["we-watched", itemId, itemType, viewerId] : null, async () => {
    const [{ data: mine }, { data: companions }, { data: follows }] = await Promise.all([
      supabase
        .from("user_ratings")
        .select("score")
        .eq("user_id", viewerId as string)
        .eq("item_id", itemId)
        .eq("item_type", itemType)
        .maybeSingle(),
      // People named on my viewings of this title.
      supabase
        .from("viewings")
        .select("viewing_companions!viewing_id(companion_user_id)")
        .eq("user_id", viewerId as string)
        .eq("item_id", itemId)
        .eq("item_type", itemType),
      supabase.from("user_connections").select("followed_id").eq("follower_id", viewerId as string),
    ]);
    if (mine?.score == null) return null;

    const withIds = new Set<string>();
    for (const v of (companions ?? []) as unknown as { viewing_companions: { companion_user_id: string | null }[] | null }[]) {
      for (const c of v.viewing_companions ?? []) if (c.companion_user_id) withIds.add(c.companion_user_id);
    }
    const followIds = (follows ?? []).map((f) => f.followed_id as string);
    const pool = [...new Set([...withIds, ...followIds])].slice(0, 200);
    if (!pool.length) return null;

    const { data: theirs } = await supabase
      .from("user_ratings")
      .select("user_id, score")
      .eq("item_id", itemId)
      .eq("item_type", itemType)
      .in("user_id", pool);
    if (!theirs?.length) return null;
    const { data: people } = await supabase
      .from("users")
      .select("id, username, avatar_url")
      .in("id", theirs.map((t) => t.user_id as string));
    const byId = new Map((people ?? []).map((p) => [p.id as string, p]));
    const others: Other[] = theirs
      .map((t): Other | null => {
        const p = byId.get(t.user_id as string);
        return p?.username
          ? { userId: t.user_id as string, username: p.username as string, avatarUrl: (p.avatar_url as string | null) ?? null, score: Number(t.score) }
          : null;
      })
      .filter((o): o is Other => o !== null)
      // Companions first: the people who were actually there.
      .sort((a, b) => Number(withIds.has(b.userId)) - Number(withIds.has(a.userId)));
    return others.length ? { mine: Number(mine.score), others } : null;
  });

  if (!ready || !viewerId) return null;
  if (!inView) return <div ref={ref} aria-hidden className="h-px" />;
  if (!data) return <div ref={ref} aria-hidden className="h-px" />;

  const other = data.others[Math.min(pick, data.others.length - 1)];
  const me = user?.username ?? "you";
  const line = `We watched ${itemName}. ${me} ${formatStars(data.mine)}, ${other.username} ${formatStars(other.score)}.`;

  const exportImage = async () => {
    if (!cardRef.current) return;
    setCapturing(true);
    try {
      await exportNodeAsPng(cardRef.current, `letsee-we-watched-${itemId}.png`, { backgroundColor: TOKENS_DARK.page });
    } catch {
      toast.error("Couldn't save the image. Screenshot the card instead.");
    } finally {
      setCapturing(false);
    }
  };

  const share = async () => {
    const url = `${window.location.origin}${titlePath(itemType, itemId, itemName)}`;
    if (navigator.share) {
      try {
        await navigator.share({ text: line, url });
        return;
      } catch {
        // Cancelled or unsupported; fall through to copy.
      }
    }
    try {
      await navigator.clipboard.writeText(`${line} ${url}`);
      toast.success("Copied");
    } catch {
      toast.error("Couldn't copy");
    }
  };

  return (
    <div ref={ref} className="rounded-2xl border border-line bg-raised/40 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Users className="size-4 shrink-0 text-accent" />
        <p className="text-sm text-ink-200">{line}</p>
        {data.others.length > 1 && (
          <button
            type="button"
            onClick={() => setPick((p) => (p + 1) % data.others.length)}
            className="text-xs text-ink-500 hover:text-ink-0"
          >
            someone else
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={share}
            className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-3 py-1.5 text-xs text-ink-300 transition hover:border-line-input hover:text-ink-0"
          >
            <Share2 className="size-3.5" /> Send
          </button>
          <button
            type="button"
            onClick={exportImage}
            disabled={capturing}
            className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-3 py-1.5 text-xs text-ink-300 transition hover:border-line-input hover:text-ink-0 disabled:opacity-50"
          >
            <Download className="size-3.5" /> Card
          </button>
        </div>
      </div>

      {/* The image, rendered off-screen. */}
      <div
        ref={cardRef}
        style={{ width: 800, height: 420, background: TOKENS_DARK.page }}
        className="fixed -left-2500 top-0 flex items-center gap-8 p-10"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={getPosterUrl(posterPath, "w342")}
          alt=""
          crossOrigin="anonymous"
          style={{ width: 220, height: 330, borderRadius: 12, objectFit: "cover", border: `1px solid ${alpha(LIGHT, 0.12)}` }}
        />
        <div style={{ flex: 1, color: TOKENS_DARK.ink0 }}>
          <p style={{ fontSize: 14, letterSpacing: 4, textTransform: "uppercase", color: alpha(TOKENS_DARK.ink0, 0.95), margin: 0 }}>We watched</p>
          <p style={{ fontSize: 40, fontWeight: 700, lineHeight: 1.1, margin: "12px 0 28px" }}>{itemName}</p>
          <div style={{ display: "flex", gap: 40 }}>
            <div>
              <p style={{ fontSize: 46, fontWeight: 700, margin: 0, lineHeight: 1 }}>{formatStars(data.mine)}</p>
              <p style={{ fontSize: 16, color: alpha(LIGHT, 0.6), margin: "8px 0 0" }}>@{me}</p>
            </div>
            <div>
              <p style={{ fontSize: 46, fontWeight: 700, margin: 0, lineHeight: 1 }}>{formatStars(other.score)}</p>
              <p style={{ fontSize: 16, color: alpha(LIGHT, 0.6), margin: "8px 0 0" }}>@{other.username}</p>
            </div>
          </div>
          <p style={{ fontSize: 13, color: alpha(LIGHT, 0.4), margin: "36px 0 0" }}>LetSee</p>
        </div>
      </div>
    </div>
  );
}
