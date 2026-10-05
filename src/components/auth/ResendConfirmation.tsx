"use client";

import { useState } from "react";
import { MailCheck } from "lucide-react";
import { supabase } from "@/utils/supabase/client";
import { authMessage, authProblem } from "@/lib/auth/messages";
import { useCooldown } from "@/lib/auth/email";
import { Notice, authSecondary } from "@components/auth/AuthShell";

/** "Didn't get it?" — the confirmation email again, at most once a minute. */
export default function ResendConfirmation({
  email,
  redirectTo,
  justSent = false,
  hint = true,
}: {
  email: string;
  redirectTo: () => string;
  /** An email went out a moment ago, and asking again inside a minute is refused. */
  justSent?: boolean;
  hint?: boolean;
}) {
  const [wait, startWait] = useCooldown(justSent ? 60 : 0);
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<{ tone: "error" | "info"; text: string } | null>(null);

  const resend = async () => {
    if (!email || wait > 0) return;
    setSending(true);
    setNote(null);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: redirectTo() } });
      if (error) {
        setNote({ tone: "error", text: authMessage(error) });
        if (authProblem(error) === "email_rate_limit") startWait(60);
      } else {
        setNote({ tone: "info", text: "Sent again. It can take a minute — look in spam too." });
        startWait(60);
      }
    } catch {
      setNote({ tone: "error", text: authMessage({ name: "AuthRetryableFetchError", status: 0 }) });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {hint && (
        <div className="flex items-start gap-3 rounded-card bg-raised p-4 ring-1 ring-inset ring-line-strong">
          <MailCheck className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
          <p className="text-sm leading-relaxed text-ink-300">It can take a minute to arrive. If it isn&apos;t in your inbox, look in spam or promotions.</p>
        </div>
      )}
      {note && <Notice tone={note.tone}>{note.text}</Notice>}
      <button type="button" onClick={resend} disabled={sending || wait > 0 || !email} className={authSecondary}>
        {sending ? "Sending…" : wait > 0 ? `Send it again in ${wait}s` : justSent ? "Send it again" : "Send the confirmation link"}
      </button>
    </div>
  );
}
