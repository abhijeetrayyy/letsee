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
  /** Inside a page section that already has its own heading and card (settings). */
  bare?: boolean;
};

/**
 * Which services you have, and where.
 *
 * The one piece of data Tonight cannot work without and cannot infer. Kept to
 * a single grid of names with no search box and no categories: it is asked
 * once, and anything more elaborate would be a form standing between someone
 * and the thing they came for.
 */
export default function ServicePicker({ onSaved, onCancel, bare = false }: Props) {
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
  // Plus any you already have that sit below it: a save writes exactly the
  // chips shown, so a service missing from them was silently dropped.
  const providers = useMemo(() => {
    const all = catalogue?.providers ?? [];
    const top = all.slice(0, 32);
    const shown = new Set(top.map((p) => p.id));
    const yours = (mine?.region === effectiveRegion ? mine.providers : []).filter((p) => !shown.has(p.id));
    return [...top, ...yours];
  }, [catalogue, mine, effectiveRegion]);

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
    <div className={bare ? "" : "rounded-card border border-line-strong bg-raised/40 p-5 sm:p-6"}>
      {!bare && (
        <>
          <h2 className="text-2xl text-ink-0">What do you have?</h2>
          <p className="mt-1 text-sm text-ink-400">So we only suggest things you can actually put on.</p>
        </>
      )}

      <label className={`block ${bare ? "" : "mt-5"}`}>
        <span className="text-sm font-medium text-ink-0">Country</span>
        <select
          value={effectiveRegion}
          onChange={(e) => {
            setTouched(true);
            setRegion(e.target.value);
            setSelected(new Set());
          }}
          className="mt-2 h-10 w-full rounded-control bg-raised px-3 text-sm text-ink-0 ring-1 ring-inset ring-line-input focus:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:w-64"
        >
          {countries.map((c) => (
            <option key={c.iso_3166_1} value={c.iso_3166_1}>
              {c.english_name}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-5">
        <span className="text-sm font-medium text-ink-0">Services</span>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-ink-400 py-6">
            <Loader2 className="size-4 animate-spin" />
            Loading services…
          </div>
        ) : providers.length === 0 ? (
          <p className="text-ink-500 text-sm py-6">
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
                  className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors ${
                    on ? "bg-action text-on-action" : "text-ink-300 ring-1 ring-inset ring-line-input hover:bg-hover hover:text-ink-0"
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

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      <div className="flex items-center gap-3 mt-6">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex h-11 items-center rounded-full bg-action px-6 text-base font-semibold text-on-action transition-colors hover:bg-action-hover disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-ink-400 hover:text-ink-0 transition"
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}
