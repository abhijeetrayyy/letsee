import Avatar from "@components/ui/Avatar";

/**
 * Two or three people together: faces overlapping by a quarter, each ringed in
 * the page colour so the edges read (docs/design/SYSTEM.md §2, `Pair`).
 */
export default function Faces({ people, size = 24, max = 3 }: { people: { username: string; avatarUrl: string | null }[]; size?: number; max?: number }) {
  const shown = people.slice(0, max);
  return (
    <span className="flex shrink-0 items-center" aria-hidden>
      {shown.map((p, i) => (
        <span key={p.username} className="rounded-full ring-2 ring-page" style={{ marginLeft: i ? -size / 4 : 0, zIndex: shown.length - i }}>
          <Avatar src={p.avatarUrl} name={p.username} size={size} />
        </span>
      ))}
    </span>
  );
}
