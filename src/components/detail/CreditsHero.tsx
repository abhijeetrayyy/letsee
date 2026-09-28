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

/** Compact context for a directory page, not a second title-page hero. */
export default function CreditsHero({
  mediaType,
  id,
  title,
  posterPath,
  backdropPath,
  adult = false,
}: CreditsHeroProps) {
  const href = titlePath(mediaType, id, title);

  return (
    <header className="relative overflow-hidden border-b border-surface-800/70 bg-surface-900">
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={backdropPath && !adult ? `https://image.tmdb.org/t/p/w780${backdropPath}` : "/backgroundjpeg.webp"}
          alt=""
          className="size-full object-cover opacity-15"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-surface-950 via-surface-950/90 to-surface-950/60" />
        <div className="absolute inset-0 bg-gradient-to-t from-surface-950 to-transparent" />
      </div>

      <div className="relative mx-auto flex min-h-[250px] max-w-6xl items-end gap-5 px-4 py-8 sm:min-h-[300px] sm:px-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={posterPath && !adult ? `https://image.tmdb.org/t/p/w342${posterPath}` : adult ? "/pixeled.webp" : "/no-photo.webp"}
          alt={`${title} poster`}
          className="hidden aspect-[2/3] w-28 shrink-0 rounded-xl object-cover shadow-2xl ring-1 ring-white/10 sm:block md:w-36"
        />
        <div className="min-w-0 pb-1">
          <Link href={href} className="inline-flex items-center gap-1.5 text-sm text-surface-400 transition-colors hover:text-white">
            <ArrowLeft className="size-4" />
            Back to {title}
          </Link>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-brand-400">Credits</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-white sm:text-4xl">Cast &amp; crew</h1>
          <p className="mt-2 truncate text-sm text-surface-400">{title}</p>
        </div>
      </div>
    </header>
  );
}
