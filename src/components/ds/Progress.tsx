import Avatar from "@components/ui/Avatar";

/**
 * A season as dots (docs/design/SYSTEM.md §8, `Progress`): yours filled
 * white, the rest an outline, the ones not out yet barely there — and each of
 * your people as a small face above the furthest episode they've reached.
 *
 * Past 60 episodes a dot each stops being readable, so a long season becomes
 * a single hairline with the same meaning.
 */
export type ProgressCell = { n: number; state: "seen" | "open" | "notout" };
type Face = { username: string; avatarUrl: string | null };

export default function Progress({ cells, reached, label }: { cells: ProgressCell[]; reached?: Map<number, Face[]>; label: string }) {
  if (!cells.length) return null;
  const seen = cells.filter((c) => c.state === "seen").length;

  if (cells.length > 60) {
    const out = cells.filter((c) => c.state !== "notout").length || 1;
    return (
      <div role="img" aria-label={label} className="h-1 overflow-hidden rounded-full bg-line-strong">
        <div className="h-full bg-action" style={{ width: `${Math.min(100, (seen / out) * 100)}%` }} />
      </div>
    );
  }

  const withFaces = !!reached?.size;
  return (
    // One picture with one label, so its dots are not list items (a list
    // inside role="img" is a list nobody can reach).
    <div role="img" aria-label={label} className="flex flex-wrap gap-y-2">
      {cells.map((c) => {
        const faces = reached?.get(c.n) ?? [];
        return (
          <span key={c.n} className="flex w-4 flex-col items-center gap-1">
            {withFaces && (
              <span className="flex h-4 items-end">
                {faces[0] && <Avatar src={faces[0].avatarUrl} name={faces[0].username} size={16} />}
              </span>
            )}
            <span
              className={`size-2.5 rounded-full ${
                c.state === "seen" ? "bg-action" : c.state === "open" ? "ring-1 ring-inset ring-ink-500" : "ring-1 ring-inset ring-line-strong"
              }`}
            />
          </span>
        );
      })}
    </div>
  );
}
