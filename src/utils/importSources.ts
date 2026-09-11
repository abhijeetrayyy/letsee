/**
 * Reading exports from everywhere else: Trakt, Simkl, TV Time, IMDb, Netflix.
 *
 * ── Why ────────────────────────────────────────────────────────────────────
 * TV Time shut down on 2026-07-15 and deleted its data; Trakt and Simkl sell
 * export; every migration wave in this category was won by whoever could
 * ingest the diary (docs/WHY_PEOPLE_COME_BACK.md §9 Bet 4c). Each parser here
 * produces the same `ImportRecord[]` the Letterboxd reader does, so the rest
 * of the pipeline — resolve, apply, resume, the unresolved list — is shared.
 *
 * ── What each source knows ─────────────────────────────────────────────────
 *   Trakt    JSON. TMDB ids on everything. Per-episode history with dates.
 *   Simkl    JSON. TMDB/IMDb ids, a status, a rating, per-episode dates.
 *   TV Time  CSV. Series keyed on TheTVDB, episodes with a watched date.
 *   IMDb     CSV. `Const` is the IMDb id; a rating, or a watchlist.
 *   Netflix  CSV. Titles only — "Show: Season 2: Episode name" — and a date.
 *
 * Every parser is tolerant of column drift and never throws on a row it does
 * not understand; a warning is recorded and the row skipped.
 */

import { unzipSync } from "fflate";
import {
  addViewingDate,
  keyOf,
  parseCsv,
  parseDate,
  parseYear,
  toObjects,
  type ImportEpisode,
  type ImportRecord,
  type ParseResult,
} from "@/utils/letterboxd";

export type ImportSource = "letterboxd" | "trakt" | "simkl" | "tvtime" | "imdb" | "netflix";

export const IMPORT_SOURCES: ImportSource[] = ["letterboxd", "trakt", "simkl", "tvtime", "imdb", "netflix"];

export function isImportSource(v: unknown): v is ImportSource {
  return typeof v === "string" && (IMPORT_SOURCES as string[]).includes(v);
}

const DECODER = new TextDecoder("utf-8");

function blank(title: string, year: number | null, hint: "movie" | "tv" | null): ImportRecord {
  return {
    title,
    year,
    letterboxdUri: null,
    watched: false,
    watchlist: false,
    favorite: false,
    rating: null,
    reviewText: null,
    watchedDate: null,
    mediaHint: hint,
    tmdbHint: null,
    imdbId: null,
    tvdbId: null,
    viewingDates: [],
    episodes: [],
  };
}

/**
 * A calendar date from whatever the export wrote. Never through
 * `toISOString()`: that converts to UTC first, and a viewing on the evening
 * of the 2nd in Kolkata would become the 1st. A date is a date.
 */
function isoDate(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw) return null;
  const s = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return iso[0];
  // Netflix and IMDb write US-style m/d/yyyy (or m/d/yy).
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(s);
  if (us) {
    const y = us[3].length === 2 ? 2000 + Number(us[3]) : Number(us[3]);
    return `${y}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  }
  // "12 Sep 2021 22:15" and the like: local parts, not UTC.
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function clampRating(raw: unknown, scale: 10 | 5 = 10): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  const score = scale === 5 ? Math.round(n * 2) : Math.round(n);
  return score >= 1 && score <= 10 ? score : null;
}

function addEpisode(record: ImportRecord, ep: ImportEpisode): void {
  const list = record.episodes ?? (record.episodes = []);
  const dup = list.find((x) => x.s === ep.s && (ep.e > 0 ? x.e === ep.e : x.name && x.name === ep.name));
  if (dup) {
    if (!dup.on && ep.on) dup.on = ep.on;
    return;
  }
  list.push(ep);
}

/** Unzip or treat as one file. Returns [path, bytes] pairs. */
function entriesOf(bytes: Uint8Array, filename: string): [string, Uint8Array][] {
  const isZip = filename.toLowerCase().endsWith(".zip") || (bytes[0] === 0x50 && bytes[1] === 0x4b);
  if (!isZip) return [[filename, bytes]];
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    throw new Error("That ZIP couldn't be opened. Try re-downloading your export.");
  }
  return Object.entries(entries).filter(([p, c]) => !p.toLowerCase().includes("__macosx") && c.length > 0);
}

// ── Trakt ───────────────────────────────────────────────────────────────────

type TraktIds = { trakt?: number; slug?: string; imdb?: string | null; tmdb?: number | null; tvdb?: number | null };
type TraktMovie = { title?: string; year?: number | null; ids?: TraktIds };
type TraktShow = { title?: string; year?: number | null; ids?: TraktIds };
type TraktEntry = {
  type?: string;
  watched_at?: string;
  listed_at?: string;
  rated_at?: string;
  rating?: number;
  plays?: number;
  last_watched_at?: string;
  movie?: TraktMovie;
  show?: TraktShow;
  episode?: { season?: number; number?: number; title?: string; ids?: TraktIds };
  seasons?: { number?: number; episodes?: { number?: number; plays?: number; last_watched_at?: string }[] }[];
};

function traktRecord(into: Map<string, ImportRecord>, item: TraktMovie | TraktShow, hint: "movie" | "tv"): ImportRecord | null {
  const title = (item.title ?? "").trim();
  if (!title) return null;
  const year = typeof item.year === "number" ? item.year : null;
  const tmdb = item.ids?.tmdb ? String(item.ids.tmdb) : null;
  const key = tmdb ? `tmdb:${hint}:${tmdb}` : keyOf(title, year, hint);
  const record = into.get(key) ?? blank(title, year, hint);
  record.tmdbHint ??= tmdb;
  record.imdbId ??= item.ids?.imdb ?? null;
  record.tvdbId ??= item.ids?.tvdb ? String(item.ids.tvdb) : null;
  into.set(key, record);
  return record;
}

export function parseTraktExport(bytes: Uint8Array, filename: string): ParseResult {
  const warnings: string[] = [];
  const filesSeen: string[] = [];
  const merged = new Map<string, ImportRecord>();

  for (const [path, content] of entriesOf(bytes, filename)) {
    if (!path.toLowerCase().endsWith(".json")) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(DECODER.decode(content));
    } catch {
      warnings.push(`${path} is not valid JSON and was skipped.`);
      continue;
    }
    const list = Array.isArray(parsed) ? (parsed as TraktEntry[]) : null;
    if (!list) continue;
    const base = path.toLowerCase().split("/").pop() ?? path;
    const isWatchlist = base.includes("watchlist");
    const isRating = base.includes("rating");
    filesSeen.push(base.replace(/-\d+\.json$/, ".json"));

    for (const entry of list) {
      if (!entry || typeof entry !== "object") continue;
      const date = isoDate(entry.watched_at ?? entry.last_watched_at ?? entry.listed_at ?? entry.rated_at);

      if (entry.movie) {
        const r = traktRecord(merged, entry.movie, "movie");
        if (!r) continue;
        if (isWatchlist) r.watchlist = true;
        else if (isRating) {
          r.rating ??= clampRating(entry.rating);
          r.watched = true;
        } else {
          r.watched = true;
          addViewingDate(r, date);
        }
        continue;
      }

      if (entry.show) {
        const r = traktRecord(merged, entry.show, "tv");
        if (!r) continue;
        if (isWatchlist) {
          r.watchlist = true;
        } else if (isRating && !entry.episode) {
          r.rating ??= clampRating(entry.rating);
          r.watched = true;
        } else if (entry.episode) {
          const s = Number(entry.episode.season);
          const e = Number(entry.episode.number);
          if (Number.isInteger(s) && Number.isInteger(e) && e >= 1) addEpisode(r, { s, e, on: date });
        } else if (entry.seasons) {
          for (const season of entry.seasons) {
            const s = Number(season.number);
            for (const ep of season.episodes ?? []) {
              const e = Number(ep.number);
              if (Number.isInteger(s) && Number.isInteger(e) && e >= 1) {
                addEpisode(r, { s, e, on: isoDate(ep.last_watched_at) });
              }
            }
          }
          if (date) addViewingDate(r, date);
        } else {
          r.watched = true;
          addViewingDate(r, date);
        }
      }
    }
  }

  if (filesSeen.length === 0) {
    throw new Error("No Trakt data found. Upload the ZIP from Settings → Data → Export, or one of its JSON files.");
  }

  return { records: finish(merged), filesSeen: [...new Set(filesSeen)], warnings };
}

// ── Simkl ───────────────────────────────────────────────────────────────────

type SimklIds = { simkl?: number; imdb?: string; tmdb?: string | number; tvdb?: string | number };
type SimklItem = {
  title?: string;
  year?: number;
  ids?: SimklIds;
  status?: string;
  user_rating?: number | null;
  last_watched_at?: string | null;
  seasons?: { number?: number; episodes?: { number?: number; watched_at?: string | null }[] }[];
  movie?: { title?: string; year?: number; ids?: SimklIds };
  show?: { title?: string; year?: number; ids?: SimklIds };
};

export function parseSimklExport(bytes: Uint8Array, filename: string): ParseResult {
  const warnings: string[] = [];
  const merged = new Map<string, ImportRecord>();
  let found = false;

  for (const [path, content] of entriesOf(bytes, filename)) {
    if (!path.toLowerCase().endsWith(".json")) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(DECODER.decode(content));
    } catch {
      warnings.push(`${path} is not valid JSON and was skipped.`);
      continue;
    }
    const root = (parsed ?? {}) as Record<string, unknown>;
    const groups: [string, "movie" | "tv"][] = [["movies", "movie"], ["shows", "tv"], ["anime", "tv"]];
    for (const [key, hint] of groups) {
      const list = Array.isArray(root[key]) ? (root[key] as SimklItem[]) : null;
      if (!list) continue;
      found = true;
      for (const raw of list) {
        const item = raw.movie ?? raw.show ?? raw;
        const title = (item.title ?? "").trim();
        if (!title) continue;
        const year = typeof item.year === "number" ? item.year : null;
        const tmdb = item.ids?.tmdb != null ? String(item.ids.tmdb) : null;
        const k = tmdb ? `tmdb:${hint}:${tmdb}` : keyOf(title, year, hint);
        const r = merged.get(k) ?? blank(title, year, hint);
        r.tmdbHint ??= tmdb;
        r.imdbId ??= item.ids?.imdb ?? null;
        r.tvdbId ??= item.ids?.tvdb != null ? String(item.ids.tvdb) : null;
        const status = (raw.status ?? "").toLowerCase();
        if (status === "plantowatch" || status === "watchlist") r.watchlist = true;
        else if (status === "completed" || (!status && hint === "movie")) {
          r.watched = true;
          addViewingDate(r, isoDate(raw.last_watched_at));
        }
        r.rating ??= clampRating(raw.user_rating);
        for (const season of raw.seasons ?? []) {
          const s = Number(season.number);
          for (const ep of season.episodes ?? []) {
            const e = Number(ep.number);
            if (Number.isInteger(s) && Number.isInteger(e) && e >= 1) addEpisode(r, { s, e, on: isoDate(ep.watched_at) });
          }
        }
        merged.set(k, r);
      }
    }
  }

  if (!found) throw new Error("No Simkl data found. Upload the JSON from Settings → Export.");
  return { records: finish(merged), filesSeen: ["simkl.json"], warnings };
}

// ── TV Time ─────────────────────────────────────────────────────────────────

/** Find a column by any of several names, tolerant of the export's drift. */
function col(obj: Record<string, string>, ...names: string[]): string {
  for (const n of names) {
    const v = obj[n];
    if (v != null && v !== "") return v;
  }
  // Loose match: a header containing the name.
  for (const n of names) {
    const hit = Object.keys(obj).find((k) => k.includes(n));
    if (hit && obj[hit]) return obj[hit];
  }
  return "";
}

export function parseTvTimeExport(bytes: Uint8Array, filename: string): ParseResult {
  const warnings: string[] = [];
  const filesSeen: string[] = [];
  const merged = new Map<string, ImportRecord>();

  for (const [path, content] of entriesOf(bytes, filename)) {
    if (!path.toLowerCase().endsWith(".csv")) continue;
    const objects = toObjects(parseCsv(DECODER.decode(content)));
    if (!objects.length) continue;
    const base = path.toLowerCase().split("/").pop() ?? path;
    filesSeen.push(base);
    let used = 0;

    for (const obj of objects) {
      const type = col(obj, "entity_type", "type", "kind").toLowerCase();
      const movieName = col(obj, "movie_name", "movie_title");
      const seriesName = col(obj, "series_name", "tv_show_name", "show_name", "show_title", "series_title", "title", "name");
      const date = isoDate(col(obj, "watched_at", "created_at", "date", "updated_at"));

      if (movieName || type === "movie") {
        const title = (movieName || seriesName).trim();
        if (!title) continue;
        const tmdb = col(obj, "movie_id", "tmdb_id", "tmdb");
        const key = tmdb ? `tmdb:movie:${tmdb}` : keyOf(title, null, "movie");
        const r = merged.get(key) ?? blank(title, null, "movie");
        r.tmdbHint ??= tmdb || null;
        const status = col(obj, "status", "state").toLowerCase();
        if (status.includes("watchlist") || status.includes("plan") || type.includes("watchlist")) r.watchlist = true;
        else {
          r.watched = true;
          addViewingDate(r, date);
        }
        merged.set(key, r);
        used += 1;
        continue;
      }

      if (!seriesName) continue;
      const tvdb = col(obj, "series_id", "tvdb_id", "show_id", "tvdb");
      const key = tvdb ? `tvdb:${tvdb}` : keyOf(seriesName, null, "tv");
      const r = merged.get(key) ?? blank(seriesName.trim(), null, "tv");
      r.tvdbId ??= tvdb || null;
      const s = Number(col(obj, "season_number", "season", "episode_season_number"));
      const e = Number(col(obj, "episode_number", "episode", "number"));
      if (Number.isInteger(s) && Number.isInteger(e) && e >= 1) {
        addEpisode(r, { s, e, on: date });
      } else {
        const status = col(obj, "status", "state").toLowerCase();
        if (status.includes("watchlist") || status.includes("plan") || status.includes("follow")) r.watchlist = true;
      }
      merged.set(key, r);
      used += 1;
    }
    if (objects.length && !used) warnings.push(`${base} had rows but no column this importer recognises.`);
  }

  if (filesSeen.length === 0) throw new Error("No TV Time CSV found in that file.");
  // A series with episodes and no explicit status is one you were watching:
  // `watched` stays false and `applyRows` files it under "watching".
  return { records: finish(merged), filesSeen: [...new Set(filesSeen)], warnings };
}

// ── IMDb ────────────────────────────────────────────────────────────────────

export function parseImdbExport(bytes: Uint8Array, filename: string): ParseResult {
  const warnings: string[] = [];
  const merged = new Map<string, ImportRecord>();
  const isWatchlistFile = filename.toLowerCase().includes("watchlist");

  for (const [path, content] of entriesOf(bytes, filename)) {
    if (!path.toLowerCase().endsWith(".csv")) continue;
    const objects = toObjects(parseCsv(DECODER.decode(content)));
    for (const obj of objects) {
      const imdb = col(obj, "const", "imdb id", "tconst");
      const title = col(obj, "title", "original title").trim();
      if (!imdb && !title) continue;
      const typeRaw = col(obj, "title type").toLowerCase();
      const hint: "movie" | "tv" | null = typeRaw.includes("series") || typeRaw.includes("episode") ? "tv" : typeRaw ? "movie" : null;
      const year = parseYear(col(obj, "year"));
      const key = imdb ? `imdb:${imdb}` : keyOf(title, year, hint);
      const r = merged.get(key) ?? blank(title || imdb, year, hint);
      r.imdbId ??= imdb || null;
      const rating = clampRating(col(obj, "your rating"));
      const listed = isWatchlistFile || (!rating && !!col(obj, "created", "date added"));
      if (rating !== null) {
        r.rating = rating;
        r.watched = true;
        addViewingDate(r, isoDate(col(obj, "date rated")));
      } else if (listed) {
        r.watchlist = true;
      } else {
        r.watched = true;
      }
      merged.set(key, r);
    }
  }

  if (merged.size === 0) throw new Error("No IMDb rows found. Export your ratings or watchlist as CSV from IMDb.");
  return { records: finish(merged), filesSeen: [isWatchlistFile ? "watchlist.csv" : "ratings.csv"], warnings };
}

// ── Netflix ─────────────────────────────────────────────────────────────────

/**
 * "Breaking Bad: Season 4: Bullet Points" → show, season, episode name.
 * Limited series and "Part N" collections count as season 1 / N.
 */
export function splitNetflixTitle(raw: string): { show: string; season: number; episode: string } | null {
  const t = raw.trim();
  const m = /^(?<show>.+?): (?:Season (?<s>\d+)|Series (?<s2>\d+)|Part (?<p>\d+)|Limited Series|Volume (?<v>\d+)|Book (?<b>\d+)|Chapter (?<c>\d+)): (?<ep>.+)$/.exec(t);
  if (!m?.groups) return null;
  const g = m.groups;
  const season = Number(g.s ?? g.s2 ?? g.p ?? g.v ?? g.b ?? g.c ?? 1);
  return { show: g.show.trim(), season: Number.isInteger(season) && season > 0 ? season : 1, episode: g.ep.trim() };
}

export function parseNetflixExport(bytes: Uint8Array, filename: string): ParseResult {
  const warnings: string[] = [];
  const merged = new Map<string, ImportRecord>();
  let rowsSeen = 0;

  for (const [path, content] of entriesOf(bytes, filename)) {
    if (!path.toLowerCase().endsWith(".csv")) continue;
    const objects = toObjects(parseCsv(DECODER.decode(content)));
    for (const obj of objects) {
      const title = col(obj, "title").trim();
      if (!title) continue;
      // Trailers, recaps and "hooks" are supplemental rows in the full export.
      if (col(obj, "supplemental video type")) continue;
      const duration = col(obj, "duration");
      if (duration && /^(\d+):(\d+):(\d+)$/.test(duration)) {
        const [h, m] = duration.split(":").map(Number);
        if (h === 0 && m < 5) continue; // a few minutes is a browse, not a viewing
      }
      rowsSeen += 1;
      const date = isoDate(col(obj, "date", "start time"));
      const split = splitNetflixTitle(title);
      if (split) {
        const key = keyOf(split.show, null, "tv");
        const r = merged.get(key) ?? blank(split.show, null, "tv");
        addEpisode(r, { s: split.season, e: 0, on: date, name: split.episode });
        merged.set(key, r);
      } else {
        const key = keyOf(title, null, "movie");
        const r = merged.get(key) ?? blank(title, null, "movie");
        r.watched = true;
        addViewingDate(r, date);
        merged.set(key, r);
      }
    }
  }

  if (rowsSeen === 0) {
    throw new Error("No Netflix viewing rows found. Download your viewing activity as CSV from Account → Profile → Viewing activity.");
  }
  return { records: finish(merged), filesSeen: ["ViewingActivity.csv"], warnings };
}

// ── Shared tail ─────────────────────────────────────────────────────────────

function finish(merged: Map<string, ImportRecord>): ImportRecord[] {
  const out: ImportRecord[] = [];
  for (const r of merged.values()) {
    if (r.watched && r.watchedDate && !(r.viewingDates ?? []).length) addViewingDate(r, r.watchedDate);
    if (r.watched || r.watchlist || r.favorite || r.rating !== null || r.reviewText || (r.episodes?.length ?? 0) > 0) out.push(r);
  }
  return out;
}

/**
 * Which export is this? Filename first, then the bytes.
 *
 * A guess that is wrong produces an honest error from the parser it chose,
 * so the cost of a miss is one clear message, not a corrupted import.
 */
export function detectSource(bytes: Uint8Array, filename: string): ImportSource | null {
  const lower = filename.toLowerCase();
  const head = DECODER.decode(bytes.slice(0, 4096)).replace(/^﻿/, "");
  const isZip = lower.endsWith(".zip") || (bytes[0] === 0x50 && bytes[1] === 0x4b);

  if (isZip) {
    try {
      const names = Object.keys(unzipSync(bytes)).map((n) => n.toLowerCase());
      if (names.some((n) => /(^|\/)(watched|ratings|watchlist|diary|reviews)\.csv$/.test(n))) return "letterboxd";
      if (names.some((n) => n.endsWith(".json") && /(history|watched|ratings|watchlist|collection)/.test(n))) return "trakt";
      if (names.some((n) => n.includes("tracking") || n.includes("tvtime") || n.includes("tv-time"))) return "tvtime";
    } catch {
      return null;
    }
    return null;
  }

  if (lower.endsWith(".json")) {
    const trimmed = head.trimStart();
    if (trimmed.startsWith("[")) return "trakt";
    if (/"(movies|shows|anime)"\s*:/.test(trimmed)) return "simkl";
    return "trakt";
  }

  const firstLine = head.split(/\r?\n/)[0]?.toLowerCase() ?? "";
  if (firstLine.includes("const") && (firstLine.includes("your rating") || firstLine.includes("title type"))) return "imdb";
  if (/(^|,)"?title"?,"?date"?/.test(firstLine) || firstLine.includes("start time") || firstLine.includes("supplemental video type")) return "netflix";
  if (firstLine.includes("letterboxd uri") || /(^|,)name,year/.test(firstLine)) return "letterboxd";
  if (/(series_name|tv_show_name|episode_number|entity_type|tvdb)/.test(firstLine)) return "tvtime";
  if (lower.includes("tracking") || lower.includes("tvtime")) return "tvtime";
  return null;
}

export function summarise(records: ImportRecord[]) {
  return {
    watched: records.filter((r) => r.watched).length,
    watchlist: records.filter((r) => r.watchlist).length,
    ratings: records.filter((r) => r.rating !== null).length,
    reviews: records.filter((r) => r.reviewText).length,
    favorites: records.filter((r) => r.favorite).length,
    episodes: records.reduce((n, r) => n + (r.episodes?.length ?? 0), 0),
    rewatches: records.reduce((n, r) => n + Math.max(0, (r.viewingDates?.length ?? 0) - 1), 0),
  };
}
