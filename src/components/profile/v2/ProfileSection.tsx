/**
 * One profile section's head: a title, an optional count, one line saying
 * what the section is, and its owner action on the right.
 *
 * The owner: "you cannot understand what is favourite, what is the list of
 * favourites, what is taste of four and what is other things." They had been
 * one section under one heading. Each now stands on its own with this head,
 * so a visitor can tell them apart at a glance and an owner can see where to
 * change each one.
 */
export default function ProfileSection({
  id,
  title,
  count,
  description,
  action,
  children,
}: {
  id: string;
  title: React.ReactNode;
  count?: number | null;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="flex items-baseline gap-2.5 text-2xl text-ink-0 sm:text-3xl">
            {title}
            {count != null && count > 0 && <span className="font-sans text-base font-normal tabular-nums text-ink-500">{count.toLocaleString("en-GB")}</span>}
          </h2>
          {description && <p className="mt-1.5 max-w-read text-sm leading-relaxed text-ink-500">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

/** The owner's quiet action button beside a section's title. */
export const sectionAction =
  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium text-ink-200 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover hover:text-ink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus";
