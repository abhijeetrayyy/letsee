"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useCountry } from "@/app/contextAPI/countryContext";

interface WatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
}

interface AvailableCountry {
  code: string;
  name?: string;
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
  country: countryProp,
}: WatchOptionsProps) {
  const { country: countryFromContext, setCountry } = useCountry();
  const country = countryProp ?? countryFromContext ?? "US";

  const [watchLink, setWatchLink] = useState<string>("");
  const [providers, setProviders] = useState<WatchProvider[]>([]);
  const [availableCountries, setAvailableCountries] = useState<AvailableCountry[]>([]);
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
          setAvailableCountries([]);
          return;
        }
        setWatchLink(body.link ?? "");
        setProviders(Array.isArray(body.providers) ? body.providers : []);
        setAvailableCountries(Array.isArray(body.availableCountries) ? body.availableCountries : []);
      })
      .catch((err) => {
        if (!cancelled) {
          setError((err as Error).message);
          setProviders([]);
          setAvailableCountries([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mediaId, mediaType, country]);

  const otherCountries = availableCountries.filter((c) => c.code !== country);

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
        <div className="space-y-3">
          <p className="text-neutral-400 text-center">
            No streaming options available in your region ({country}).
          </p>
          {otherCountries.length > 0 && (
            <div className="rounded-lg bg-neutral-800/80 border border-neutral-700 px-4 py-3">
              <p className="text-sm text-neutral-300 mb-2">
                Not in your country? Available in:
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {otherCountries.slice(0, 8).map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => setCountry(c.code)}
                    className="text-sm px-3 py-1.5 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-amber-200 hover:text-amber-100 transition-colors"
                  >
                    {c.name ?? c.code}
                  </button>
                ))}
              </div>
              <p className="text-xs text-neutral-500 mt-2 text-center">
                Click a country to switch and view providers
              </p>
            </div>
          )}
        </div>
      )}
      <p className="text-xs text-neutral-500 text-center mt-4">
        Data provided by JustWatch via TMDb
      </p>
    </div>
  );
}
