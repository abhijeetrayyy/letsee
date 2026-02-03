"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

interface WatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
}

interface WatchOptionsProps {
  mediaId: number;
  mediaType: "movie" | "tv";
  country?: string;
}

const providerFallbackUrls: Record<number, string> = {
  8: "https://www.netflix.com",
  9: "https://www.amazon.com/Prime-Video",
  15: "https://www.hulu.com",
  337: "https://www.disneyplus.com",
  350: "https://www.hbomax.com",
  386: "https://www.paramountplus.com",
  531: "https://www.mubi.com",
};

export default function WatchOptionsViewer({
  mediaId,
  mediaType,
  country = "US",
}: WatchOptionsProps) {
  const [watchLink, setWatchLink] = useState<string>("");
  const [providers, setProviders] = useState<WatchProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      mediaType,
      mediaId: String(mediaId),
      country,
    });
    fetch(`/api/watch-providers?${params}`)
      .then((res) => res.json())
      .then((body) => {
        if (cancelled) return;
        if (body.error) {
          setError(body.error);
          setProviders([]);
          setWatchLink("");
          return;
        }
        setWatchLink(body.link ?? "");
        setProviders(Array.isArray(body.providers) ? body.providers : []);
      })
      .catch((err) => {
        if (!cancelled) {
          setError((err as Error).message);
          setProviders([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mediaId, mediaType, country]);

  if (loading) {
    return (
      <div className="w-full max-w-3xl mx-auto py-6">
        <p className="text-neutral-400 text-center">Loading watch options...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-3xl mx-auto py-6">
        <p className="text-amber-200/90 text-center text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto py-6 px-4">
      <h2 className="text-lg sm:text-xl font-semibold text-neutral-100 mb-4 text-center">
        Where to Watch
      </h2>
      {providers.length > 0 ? (
        <div className="flex flex-wrap justify-center gap-6">
          {providers.map((provider) => {
            const href =
              watchLink || providerFallbackUrls[provider.provider_id] || "#";
            return (
              <Link
                key={provider.provider_id}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center w-20 sm:w-24 hover:opacity-80 transition-opacity duration-200"
              >
                {provider.logo_path ? (
                  <Image
                    src={`https://image.tmdb.org/t/p/w92${provider.logo_path}`}
                    alt={provider.provider_name}
                    width={64}
                    height={64}
                    className="rounded-md object-contain"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-md bg-neutral-700 flex items-center justify-center text-neutral-400 text-xs text-center px-1">
                    {provider.provider_name}
                  </div>
                )}
                <span className="text-xs sm:text-sm text-neutral-200 text-center mt-2">
                  {provider.provider_name}
                </span>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="text-neutral-400 text-center">
          No streaming options available in {country}.
        </p>
      )}
      <p className="text-xs text-neutral-500 text-center mt-4">
        Data provided by JustWatch via TMDb
      </p>
    </div>
  );
}
