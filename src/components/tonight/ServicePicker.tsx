"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { Check, Loader2 } from "lucide-react";
import { swrFetcher } from "@/utils/swrFetcher";
import { Countrydata } from "@/staticData/countryName";

type Provider = { id: number; name: string };

type Props = {
  /** Called once the save lands, so Tonight can resolve with real constraints. */
  onSaved?: (region: string, providerIds: number[]) => void;
  onCancel?: () => void;
};

/**
 * Which services you have, and where.
 *
 * The one piece of data Tonight cannot work without and cannot infer. Kept to
 * a single grid of names with no search box and no categories: it is asked
 * once, and anything more elaborate would be a form standing between someone
 * and the thing they came for.
 */
export default function ServicePicker({ onSaved, onCancel }: Props) {
  const { data: mine } = useSWR<{ region: string; providers: Provider[] }>(
    "/api/user/providers",
    swrFetcher,
  );

  const [region, setRegion] = useState<string>("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  // Hydrate once from the server, then leave the user's edits alone.
  useEffect(() => {
    if (!mine || touched) return;
    setRegion(mine.region);
    setSelected(new Set(mine.providers.map((p) => p.id)));
  }, [mine, touched]);

  const effectiveRegion = region || mine?.region || "US";

  const { data: catalogue, isLoading } = useSWR<{ providers: Provider[] }>(
    `/api/watch-providers/list?region=${effectiveRegion}&mediaType=movie`,
    swrFetcher,
  );

  // TMDB lists well over a hundred providers per region, most of them niche
  // rental storefronts. The top slice by display_priority is what people
  // actually subscribe to, and the API already returns them in that order.
  const providers = useMemo(() => (catalogue?.providers ?? []).slice(0, 32), [catalogue]);

  const countries = useMemo(
    () =>
      [...Countrydata]
        .filter((c) => c.iso_3166_1 && c.english_name)
        .sort((a, b) => a.english_name.localeCompare(b.english_name)),
    [],
  );

  const toggle = (id: number) => {
    setTouched(true);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/user/providers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          region: effectiveRegion,
          providers: providers
            .filter((p) => selected.has(p.id))
            .map((p) => ({ id: p.id, name: p.name })),
        }),
      });
      if (!res.ok) throw new Error((await res.json())?.error ?? "Could not save");
      onSaved?.(effectiveRegion, [...selected]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-surface-800 bg-surface-900/60 p-5 sm:p-6">
      <h2 className="text-white font-semibold text-lg">What do you have?</h2>
      <p className="text-surface-400 text-sm mt-1">
        So we only suggest things you can actually put on.
      </p>

      <label className="block mt-5">
        <span className="text-xs font-semibold text-surface-500 uppercase tracking-[0.15em]">
          Country
        </span>
        <select
          value={effectiveRegion}
          onChange={(e) => {
            setTouched(true);
            setRegion(e.target.value);
            setSelected(new Set());
          }}
          className="mt-2 w-full sm:w-64 rounded-xl bg-surface-950 border border-surface-800 px-3 py-2.5 text-sm text-white focus:border-brand-500 focus:outline-none"
        >
          {countries.map((c) => (
            <option key={c.iso_3166_1} value={c.iso_3166_1}>
              {c.english_name}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-5">
        <span className="text-xs font-semibold text-surface-500 uppercase tracking-[0.15em]">
          Services
        </span>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-surface-400 py-6">
            <Loader2 className="size-4 animate-spin" />
            Loading services…
          </div>
        ) : providers.length === 0 ? (
          <p className="text-surface-500 text-sm py-6">
            No services listed for this country. You can still get picks — they just won&apos;t be
            filtered by what you have.
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {providers.map((p) => {
              const on = selected.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  aria-pressed={on}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm transition ${
                    on
                      ? "border-brand-500 bg-brand-500/15 text-brand-300"
                      : "border-surface-700 bg-surface-950/60 text-surface-300 hover:border-surface-600 hover:text-white"
                  }`}
                >
                  {on && <Check className="size-3.5" />}
                  {p.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {error && <p className="text-rose-400 text-sm mt-4">{error}</p>}

      <div className="flex items-center gap-3 mt-6">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="btn-primary text-sm px-5 py-2.5 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-surface-400 hover:text-white transition"
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}
