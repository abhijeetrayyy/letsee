-- 101_an_import_can_come_from_anywhere.sql
-- The import pipeline stops being shaped like one Letterboxd film.
--
-- ── Why now ────────────────────────────────────────────────────────────────
-- TV Time shut down on 2026-07-15 and deleted its data; Trakt and Simkl
-- charge for export; every migration wave in this category was won by
-- whoever could ingest the diary. docs/WHY_PEOPLE_COME_BACK.md §2, §9 Bet 4c.
--
-- ── What `import_rows` could not hold ──────────────────────────────────────
-- 058 made a row one film: a name, a year, five flags, one date. Three things
-- every other export carries had nowhere to go:
--
--   * external ids — Trakt and Simkl exports carry TMDB ids, TV Time carries
--     TVDB ids, IMDb carries its own — which resolve exactly and without a
--     search, through TMDB's /find;
--   * whether the row is a series (the resolver only ever searched movies);
--   * more than one viewing of the same title, and per-episode history.
--
-- ── The columns ────────────────────────────────────────────────────────────
--   media_hint     'movie' | 'tv' when the source says so
--   tmdb_hint      the source's TMDB id, if it has one
--   imdb_id        tt… id, if it has one
--   tvdb_id        TheTVDB id, if it has one
--   viewing_dates  every dated viewing of the title; rewatches included
--   episodes       jsonb [{s, e, on}] of watched episodes for a series
--
-- The (job, title, year) unique index gains media_hint and the three ids, so
-- a series and a film sharing a name and a year — or two films sharing both,
-- told apart only by their ids — are two rows, not one clash.
--
-- `letterboxd_uri` stays; `source` on import_jobs was never constrained, so
-- 'trakt', 'simkl', 'tvtime', 'imdb', 'netflix' need nothing here.
--
-- Idempotent.

BEGIN;

ALTER TABLE public.import_rows
  ADD COLUMN IF NOT EXISTS media_hint text,
  ADD COLUMN IF NOT EXISTS tmdb_hint text,
  ADD COLUMN IF NOT EXISTS imdb_id text,
  ADD COLUMN IF NOT EXISTS tvdb_id text,
  ADD COLUMN IF NOT EXISTS viewing_dates date[],
  ADD COLUMN IF NOT EXISTS episodes jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'import_rows_media_hint_check') THEN
    ALTER TABLE public.import_rows ADD CONSTRAINT import_rows_media_hint_check
      CHECK (media_hint IS NULL OR media_hint IN ('movie', 'tv'));
  END IF;
END $$;

-- The two Pinocchios of 2022 share a title, a year and a type and are two
-- films; an export that carries ids keeps them apart, so the key does too.
DROP INDEX IF EXISTS public.import_rows_job_title_year_idx;
CREATE UNIQUE INDEX IF NOT EXISTS import_rows_job_title_year_idx
  ON public.import_rows (
    job_id, lower(title), COALESCE(year, 0), COALESCE(media_hint, ''),
    COALESCE(tmdb_hint, ''), COALESCE(imdb_id, ''), COALESCE(tvdb_id, '')
  );

DO $$
DECLARE
  v_cols integer;
BEGIN
  SELECT count(*) INTO v_cols
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'import_rows'
     AND column_name IN ('media_hint', 'tmdb_hint', 'imdb_id', 'tvdb_id', 'viewing_dates', 'episodes');
  IF v_cols <> 6 THEN
    RAISE EXCEPTION 'import_rows is missing columns (% of 6 present)', v_cols;
  END IF;
  RAISE NOTICE 'verified: import rows can carry ids, a media type, rewatches and episodes';
END $$;

COMMIT;
