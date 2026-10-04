import { getPosterUrl } from "@/utils/imageUrl";
import Link from "@components/ui/AppLink";

type DisplayItem = {
  position: number;
  item_id: string;
  item_type: string;
  image_url: string | null;
  item_name: string;
};

const NO_POSTER = "/no-photo.svg";

import { titlePath } from "@/utils/urls";
export default function TasteInFourStrip({ items }: { items: DisplayItem[] }) {
  if (!items?.length) return null;

  // Four posters side by side, large: the four are a portrait of the person,
  // so they get the width, not an overlapping fan of thumbnails.
  return (
    <ol className="grid max-w-read grid-cols-4 gap-3 sm:gap-5">
      {items.map((it) => {
          const href = titlePath(it.item_type, it.item_id, it.item_name);
          /**
           * Resolve rather than trust the stored string: the column holds
           * either an absolute URL or a bare TMDB "/abc.jpg", and
           * getPosterUrl accepts both.
           */
          const imgSrc = getPosterUrl(it.image_url, "w342");
          return (
            <li key={`${it.item_id}-${it.position}`} className="min-w-0">
              <Link href={href} className="group block">
                <img loading="lazy" decoding="async" src={imgSrc} alt="" className="img-fade aspect-2/3 w-full rounded-media object-cover shadow-xl ring-1 ring-inset ring-line-strong transition-opacity group-hover:opacity-90" />
                <span className="mt-2 block truncate font-display text-base text-ink-0">{it.item_name}</span>
              </Link>
            </li>
          );
        })}
    </ol>
  );
}
