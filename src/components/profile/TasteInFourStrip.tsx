import Link from "next/link";

type DisplayItem = {
  position: number;
  item_id: string;
  item_type: string;
  image_url: string | null;
  item_name: string;
};

const NO_POSTER = "/no-photo.webp";

export default function TasteInFourStrip({
  items,
}: {
  items: DisplayItem[];
}) {
  if (!items?.length) return null;

  return (
    <div className="w-full">
      <div className="flex justify-center sm:justify-start gap-0">
        {items.map((it, i) => {
          const href = `/app/${it.item_type}/${it.item_id}`;
          const imgSrc = it.image_url?.trim() || NO_POSTER;
          return (
            <Link
              key={`${it.item_id}-${it.position}`}
              href={href}
              className="relative shrink-0 w-24 sm:w-28 md:w-32 rounded-lg overflow-hidden border-2 border-neutral-700/80 shadow-xl hover:shadow-2xl hover:scale-105 hover:z-10 hover:border-amber-500/50 transition-all duration-300 -ml-3 first:ml-0"
            >
              <img
                src={imgSrc}
                alt={it.item_name}
                className="w-full aspect-2/3 object-cover"
              />
              {/* Gradient and title: visible on touch (mobile), hover-reveal on md+ */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-100 transition-opacity md:opacity-0 md:hover:opacity-100" />
              <p className="absolute bottom-0 left-0 right-0 p-2 text-xs font-medium text-white truncate bg-black/60 opacity-100 transition-opacity md:opacity-0 md:hover:opacity-100">
                {it.item_name}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
