/**
 * The prose, deliberately not at the top.
 *
 * It is absent for 82% of people, and when present its first sentence usually
 * restates the header. TMDB biographies also carry real paragraph breaks that
 * the old component collapsed into one wall by dropping the whole string into
 * a single <p> — Spielberg's is 3,390 characters containing eight newlines.
 */
export default function LifeSection({ biography, alsoKnownAs }: { biography?: string | null; alsoKnownAs?: string[] }) {
  const bio = typeof biography === "string" ? biography.trim() : "";
  const aka = (alsoKnownAs ?? []).filter(Boolean).slice(0, 6);
  if (!bio && aka.length === 0) return null;

  const paras = bio.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  // A "Read more" that reveals two words is noise, so short bios never get one.
  const long = bio.length > 400;

  const body = (
    <div className="space-y-3 text-sm leading-relaxed text-surface-300">
      {paras.map((p, i) => (
        <p key={i} className="whitespace-pre-line">{p}</p>
      ))}
    </div>
  );

  return (
    <div>
      {bio && (long ? (
        <details className="group">
          <summary className="cursor-pointer list-none">
            <div className="line-clamp-4 space-y-3 text-sm leading-relaxed text-surface-300 group-open:hidden">
              {paras.map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}
            </div>
            <span className="mt-2 inline-block text-xs text-brand-400 group-open:hidden">Read more</span>
          </summary>
          {body}
        </details>
      ) : body)}

      {aka.length > 0 && (
        <p className="mt-4 text-xs text-surface-500">
          Also known as {aka.join(" · ")}
        </p>
      )}
    </div>
  );
}
