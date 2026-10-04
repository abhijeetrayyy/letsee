"use client";

import { MessageCircle } from "lucide-react";
import Link from "@components/ui/AppLink";
import { useAuth } from "@/app/contextAPI/AuthProvider";

/**
 * **Reply** on a written take (docs/design/PAGES.md §6): opens your room with
 * the writer, the line you are answering already quoted in the composer. A
 * reply to one person's words is a conversation with them, not a comment
 * posted for everyone. Shown signed in, and not on your own.
 */
export default function ReplyInRoom({ authorId, author, quote }: { authorId: string; author: string; quote: string }) {
  const { user, status } = useAuth();
  if (status !== "ok" || !user || user.id === authorId) return null;
  const line = quote.replace(/\s+/g, " ").trim();
  const short = line.length > 140 ? `${line.slice(0, 137)}…` : line;
  return (
    <Link
      href={`/app/people/${encodeURIComponent(author)}?quote=${encodeURIComponent(short)}`}
      className="inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium text-ink-200 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover hover:text-ink-0"
    >
      <MessageCircle className="size-4" aria-hidden />
      Reply to {author}
    </Link>
  );
}
