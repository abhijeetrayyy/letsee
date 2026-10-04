import { getPosterUrl } from "@/utils/imageUrl";

/**
 * A list's cover: its first four posters, two by two (docs/design/PAGES.md
 * §6, lists). Empty places stay quiet surfaces rather than placeholders, so a
 * list of two looks like two films, not two films and two missing ones.
 */
export default function Mosaic({ posters, className = "" }: { posters: (string | null)[]; className?: string }) {
  const four = [...posters.slice(0, 4), ...Array(Math.max(0, 4 - posters.length)).fill(undefined)] as (string | null | undefined)[];
  return (
    <div className={`grid aspect-2/3 grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-media bg-page ring-1 ring-line-strong ${className}`} aria-hidden>
      {four.map((p, i) =>
        p === undefined ? (
          <div key={i} className="bg-raised" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={getPosterUrl(p, "w185")} alt="" loading="lazy" decoding="async" className="size-full bg-hover object-cover" />
        ),
      )}
    </div>
  );
}
