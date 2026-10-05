import Link from "next/link";
import Mark from "@components/ds/Mark";
import InviteBanner from "@components/doors/InviteBanner";

/**
 * One frame for every page about your account: sign up, sign in, a forgotten
 * password, a new one. The mark home, whose invitation it is when there is
 * one, a heading that says what this page is for, and one line under it.
 */
export default function AuthShell({
  title,
  lead,
  invite = false,
  children,
}: {
  title: React.ReactNode;
  lead?: React.ReactNode;
  /** Show whose invitation brought you here (sign up and sign in). */
  invite?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-page px-4 py-10">
      <div className="w-full max-w-read">
        <Link href="/" aria-label="letsee home" className="mb-10 inline-flex">
          <Mark withName={false} size="lg" />
        </Link>
        {invite && <InviteBanner />}
        <h1 className="text-4xl leading-tight text-ink-0">{title}</h1>
        {lead && <p className="mt-2 text-base leading-relaxed text-ink-400">{lead}</p>}
        <div className="mt-7">{children}</div>
      </div>
    </div>
  );
}

/** A sentence about what just happened: a problem, or news. */
export function Notice({ tone, children }: { tone: "error" | "info"; children: React.ReactNode }) {
  return tone === "error" ? (
    <div role="alert" className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
      {children}
    </div>
  ) : (
    <div role="status" className="rounded-xl border border-accent-strong/20 bg-action/10 px-4 py-3 text-sm text-ink-200">
      {children}
    </div>
  );
}

export const authInput =
  "w-full rounded-xl bg-overlay/60 px-4 py-3 text-base text-ink-0 ring-1 ring-inset ring-line-input placeholder-ink-500 transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-60";

export const authPrimary =
  "btn-primary w-full justify-center py-3.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:transform-none";

export const authSecondary =
  "inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-semibold text-ink-0 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus";

export const authLink = "font-medium text-accent underline decoration-line-input underline-offset-4 transition-colors hover:text-accent-soft";
