"use client";

import { useCallback, useRef, useState } from "react";
import { Check, LoaderCircle } from "lucide-react";

/**
 * The pieces every settings section is made of (PAGES.md §7: "sections, each
 * saving as it changes"). There is no Save button anywhere on the page: a field
 * saves when you leave it, a choice when you make it, and the section says so
 * beside its heading — quietly, and to a screen reader through a live region.
 */
export type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string };

export function useSaver() {
  const [state, setState] = useState<SaveState>({ kind: "idle" });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const run = useCallback(async (write: () => Promise<string | null>): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current);
    setState({ kind: "saving" });
    const error = await write().catch((e: unknown) => (e instanceof Error ? e.message : "That didn't save."));
    if (error) {
      setState({ kind: "error", message: error });
      return false;
    }
    setState({ kind: "saved" });
    timer.current = setTimeout(() => setState({ kind: "idle" }), 2500);
    return true;
  }, []);
  return { state, run };
}

export function Section({ id, title, hint, state, children }: { id: string; title: string; hint?: string; state?: SaveState; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 id={`${id}-title`} className="text-2xl text-ink-0">
          {title}
        </h2>
        {state && <Status state={state} />}
      </div>
      {hint && <p className="-mt-2 mb-4 text-sm text-ink-500">{hint}</p>}
      <div className="grid gap-5 rounded-card border border-line-strong bg-raised p-5 sm:p-6">{children}</div>
    </section>
  );
}

function Status({ state }: { state: SaveState }) {
  return (
    <span role="status" aria-live="polite" className="flex shrink-0 items-center gap-1.5 text-xs">
      {state.kind === "saving" && (
        <>
          <LoaderCircle className="size-3.5 animate-spin text-ink-500" aria-hidden />
          <span className="text-ink-500">Saving…</span>
        </>
      )}
      {state.kind === "saved" && (
        <>
          <Check className="size-3.5 text-accent" aria-hidden />
          <span className="text-ink-400">Saved</span>
        </>
      )}
      {state.kind === "error" && <span className="text-danger">{state.message}</span>}
    </span>
  );
}

export const inputClass =
  "w-full rounded-control bg-page px-3.5 py-2.5 text-base text-ink-0 ring-1 ring-inset ring-line-input placeholder:text-ink-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus aria-invalid:ring-danger";

/** A label above its control, with an optional line of help under it. */
export function Labeled({ id, label, help, error = false, children }: { id: string; label: string; help?: React.ReactNode; error?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink-200">
        {label}
      </label>
      {children}
      {help && (
        <p id={`${id}-help`} className={`mt-1.5 text-xs ${error ? "text-danger" : "text-ink-500"}`}>
          {help}
        </p>
      )}
    </div>
  );
}

/** An on/off row: the whole row is the switch. */
export function Toggle({ label, help, on, onChange, disabled }: { label: string; help: string; on: boolean; onChange: (on: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="-mx-2 flex items-start gap-4 rounded-control px-2 py-1.5 text-left transition-colors hover:bg-hover disabled:opacity-60"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-base text-ink-0">{label}</span>
        <span className="mt-0.5 block text-sm text-ink-500">{help}</span>
      </span>
      <span aria-hidden className={`mt-1 flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors ${on ? "bg-action" : "bg-active ring-1 ring-inset ring-line-input"}`}>
        <span className={`size-5 rounded-full bg-raised shadow transition-transform ${on ? "translate-x-4" : ""}`} />
      </span>
    </button>
  );
}
