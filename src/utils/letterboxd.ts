/**
 * Reading a Letterboxd export.
 *
 * The export is a ZIP of CSVs, of which five matter. They all describe the same
 * films from different angles, so this module's job is to collapse them into
 * one record per film — which is what makes the import cost one TMDB lookup per
 * film instead of four.
 *
 *   watched.csv     Date, Name, Year, Letterboxd URI
 *   ratings.csv     … + Rating          (0.5–5.0, half steps)
 *   watchlist.csv   Date, Name, Year, Letterboxd URI
 *   reviews.csv     … + Review, Rewatch, Tags
 *   likes/films.csv Date, Name, Year, Letterboxd URI
 *
 * A single CSV is accepted too — people often export or share just one.
 */

import { unzipSync } from "fflate";

/** One film, with everything the export said about it merged together. */
export type ImportRecord = {
  title: string;
  year: number | null;
  letterboxdUri: string | null;
  watched: boolean;
  watchlist: boolean;
  favorite: boolean;
  /** Already converted to this app's 1–10 scale. */
  rating: number | null;
  reviewText: string | null;
  /** ISO yyyy-mm-dd. */
  watchedDate: string | null;
};

export type ParseResult = {
  records: ImportRecord[];
  /** Which of the known files were actually present, for the summary. */
  filesSeen: string[];
  warnings: string[];
};

// ── CSV ─────────────────────────────────────────────────────────────────────

/**
 * RFC 4180 parser.
 *
 * Hand-rolled rather than pulled in as a dependency because the one hard part
 * is small and well defined: a review field legitimately contains commas,
 * quotes and *newlines*, so splitting on lines before splitting on commas
 * silently corrupts every multi-paragraph review in the file. A character
 * scanner is the only thing that gets that right.
 */
export function parseCsv(input: string): string[][] {
  // Strip a UTF-8 BOM — Letterboxd's files carry one and it would otherwise
  // become part of the first header name.
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      // Consume CRLF as one terminator.
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }

  // A file not ending in a newline still has a final record.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

/** Rows keyed by header name, lowercased and trimmed for tolerant lookup. */
function toObjects(rows: string[][]): Record<string, string>[] {
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = (row[i] ?? "").trim();
    });
    return obj;
  });
}

// ── Field coercion ──────────────────────────────────────────────────────────

function parseYear(raw: string | undefined): number | null {
  const n = Number(raw);
  // Cinema's first year through a little past now — anything else is a parse
  // artefact, not a film.
  return Number.isInteger(n) && n >= 1870 && n <= 2100 ? n : null;
}

/**
 * Letterboxd rates 0.5–5.0 in half steps; this app stores 1–10 integers.
 * Doubling is exact and lossless in both directions, which is the reason the
 * two scales can be reconciled at all.
 */
export function convertRating(raw: string | undefined): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  const score = Math.round(n * 2);
  return score >= 1 && score <= 10 ? score : null;
}

function parseDate(raw: string | undefined): string | null {
  if (!raw) return null;
  // Letterboxd writes yyyy-mm-dd already; validate rather than trust.
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw.trim());
  return match ? match[0] : null;
}

// ── Merging ─────────────────────────────────────────────────────────────────

/** Same film across files, regardless of case or punctuation drift. */
function keyOf(title: string, year: number | null): string {
  return `${title.trim().toLowerCase()}::${year ?? 0}`;
}

type FileKind = "watched" | "ratings" | "watchlist" | "reviews" | "likes";

/**
 * Which of the five known files this path is, or null for the many others in
 * the export (comments, lists, profile, diary) that this importer ignores.
 *
 * Matched on the basename so it works whether or not the ZIP has a top-level
 * folder, which varies between Letterboxd export versions.
 */
function classify(path: string): FileKind | null {
  const lower = path.toLowerCase();
  if (lower.includes("__macosx")) return null;
  const base = lower.split("/").pop() ?? lower;

  // likes/films.csv must be tested before the bare filename rules, since its
  // basename is "films.csv" and it's the directory that gives it meaning.
  if (lower.includes("likes/") && base === "films.csv") return "likes";
  if (base === "watched.csv") return "watched";
  if (base === "ratings.csv") return "ratings";
  if (base === "watchlist.csv") return "watchlist";
  if (base === "reviews.csv") return "reviews";
  return null;
}

function blank(title: string, year: number | null, uri: string | null): ImportRecord {
  return {
    title,
    year,
    letterboxdUri: uri,
    watched: false,
    watchlist: false,
    favorite: false,
    rating: null,
    reviewText: null,
    watchedDate: null,
  };
}

function mergeFile(
  kind: FileKind,
  csv: string,
  into: Map<string, ImportRecord>,
  warnings: string[],
): number {
  const objects = toObjects(parseCsv(csv));
  let used = 0;

  for (const obj of objects) {
    const title = (obj.name ?? "").trim();
    if (!title) continue;

    const year = parseYear(obj.year);
    const uri = obj["letterboxd uri"] || null;
    const key = keyOf(title, year);

    const record = into.get(key) ?? blank(title, year, uri);
    if (!record.letterboxdUri && uri) record.letterboxdUri = uri;

    switch (kind) {
      case "watched":
        record.watched = true;
        record.watchedDate ??= parseDate(obj.date);
        break;
      case "watchlist":
        record.watchlist = true;
        break;
      case "likes":
        record.favorite = true;
        break;
      case "ratings": {
        const rating = convertRating(obj.rating);
        if (rating !== null) record.rating = rating;
        // A rating is only ever given to something seen, even when the export's
        // watched.csv missed it.
        record.watched = true;
        break;
      }
      case "reviews": {
        const review = (obj.review ?? "").trim();
        if (review) record.reviewText = review;
        const rating = convertRating(obj.rating);
        if (rating !== null && record.rating === null) record.rating = rating;
        record.watched = true;
        record.watchedDate ??= parseDate(obj["watched date"] || obj.date);
        break;
      }
    }

    into.set(key, record);
    used += 1;
  }

  if (objects.length > 0 && used === 0) {
    warnings.push(`${kind}.csv had rows but no usable "Name" column.`);
  }
  return used;
}

// ── Entry point ─────────────────────────────────────────────────────────────

const DECODER = new TextDecoder("utf-8");

/**
 * Parse an uploaded Letterboxd export.
 *
 * Accepts the whole ZIP or a single CSV. For a lone CSV the caller passes the
 * filename so we can tell watched.csv from watchlist.csv — the two are
 * structurally identical and mean opposite things.
 */
export function parseLetterboxdExport(bytes: Uint8Array, filename: string): ParseResult {
  const warnings: string[] = [];
  const filesSeen: string[] = [];
  const merged = new Map<string, ImportRecord>();

  const isZip =
    filename.toLowerCase().endsWith(".zip") ||
    (bytes[0] === 0x50 && bytes[1] === 0x4b); // "PK"

  if (isZip) {
    let entries: Record<string, Uint8Array>;
    try {
      entries = unzipSync(bytes);
    } catch {
      throw new Error("That ZIP couldn't be opened. Try re-downloading your export.");
    }

    for (const [path, content] of Object.entries(entries)) {
      const kind = classify(path);
      if (!kind || content.length === 0) continue;
      filesSeen.push(kind);
      mergeFile(kind, DECODER.decode(content), merged, warnings);
    }

    if (filesSeen.length === 0) {
      throw new Error(
        "No Letterboxd data found in that ZIP. It should contain watched.csv, ratings.csv or watchlist.csv.",
      );
    }
  } else {
    const kind = classify(filename);
    if (!kind) {
      throw new Error(
        "Unrecognised file. Upload your Letterboxd export ZIP, or one of watched.csv, ratings.csv, watchlist.csv or reviews.csv.",
      );
    }
    filesSeen.push(kind);
    mergeFile(kind, DECODER.decode(bytes), merged, warnings);
  }

  const records = [...merged.values()].filter(
    (r) => r.watched || r.watchlist || r.favorite || r.rating !== null || r.reviewText,
  );

  return { records, filesSeen: [...new Set(filesSeen)], warnings };
}
