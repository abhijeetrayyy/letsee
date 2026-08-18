import { MessageSquare } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * The right-hand pane before you have chosen anyone.
 *
 * The conversation list is not here — it lives in the layout, so it survives
 * navigation between threads. On a phone this page is hidden entirely and the
 * list fills the screen instead; see MessagesShell.
 */
export default function MessagesIndexPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center">
      <MessageSquare className="mb-3 size-8 text-surface-700" aria-hidden />
      <p className="text-sm text-surface-400">Pick a conversation.</p>
      <p className="mt-1 text-xs text-surface-600">
        Or send someone a film from its page — that starts one.
      </p>
    </div>
  );
}
