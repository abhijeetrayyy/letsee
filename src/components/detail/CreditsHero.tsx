import Link from "@components/ui/AppLink";
import { ArrowLeft } from "lucide-react";
import { titlePath } from "@/utils/urls";

type CreditsHeroProps = {
  mediaType: "movie" | "tv";
  id: number;
  title: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  adult?: boolean;
};

/**
 * The title strip on a credits page (docs/design/PAGES.md, credits): back to
 * the title, a small poster, and what this page is. Not a second hero — the
 * page is a directory, and the list should start on screen one.
 */
export default function CreditsHero({ mediaType, id, title, posterPath, adult = false }: CreditsHeroProps) {
  return (
    <header className="mx-auto flex w-full max-w-app flex-col gap-5 px-4 pt-6 sm:px-6 sm:pt-10">
      <Link href={titlePath(mediaType, id, title)} className="inline-flex items-center gap-1.5 self-start text-sm text-ink-400 transition-colors hover:text-ink-0">
        <ArrowLeft className="size-4" aria-hidden />
        {title}
      </Link>
      <div className="flex items-end gap-4">
        {posterPath && !adult && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`https://image.tmdb.org/t/p/w154${posterPath}`} alt="" className="aspect-2/3 w-14 shrink-0 rounded-media object-cover ring-1 ring-inset ring-line" />
        )}
        <div className="min-w-0">
          <h1 className="text-3xl text-ink-0 sm:text-4xl">Cast &amp; crew</h1>
          <p className="mt-1 truncate text-sm text-ink-400">{title}</p>
        </div>
      </div>
    </header>
  );
}
