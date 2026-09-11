-- 099_availability_is_a_snapshot.sql
-- Where a title streams, remembered day by day, so that "arrived", "new this
-- week" and "leaving soon" can exist.
--
-- ── The gap in the source ──────────────────────────────────────────────────
-- TMDB's watch-provider data is JustWatch's, refreshed roughly daily, and it
-- carries no dates: no "added on", no "leaving on", and it is not in TMDB's
-- /changes feed. Everything time-based about availability has to be built by
-- remembering what was true yesterday and comparing. That is what this table
-- is. docs/research/05_tmdb_and_adjacent_data.md §2.2, §4.1–4.2.
--
-- ── The shape ──────────────────────────────────────────────────────────────
-- One row per (title, region, provider, kind). `first_seen` is the first day
-- the daily job saw the offer; `last_seen` the most recent. A row whose
-- `last_seen` is two or more days old has left (one missed day is JustWatch
-- lag, not a departure). `expires_on` and `deep_link` are filled only when a
-- source that knows them is configured (the Streaming Availability API, behind
-- STREAMING_AVAILABILITY_API_KEY); they are null otherwise and nothing breaks.
--
-- `catalog_scans` remembers when each (region, provider) was first scanned,
-- because on the first run every title is "new" — "new on your services this
-- week" must ignore anything whose first_seen is the seeding day.
--
-- Public facts, publicly readable. Written only by the cron (service_role).
--
-- Idempotent.

BEGIN;

CREATE TABLE IF NOT EXISTS public.title_availability (
    item_id text NOT NULL,
    item_type text NOT NULL,
    region text NOT NULL,
    provider_id integer NOT NULL,
    kind text NOT NULL,
    provider_name text NOT NULL DEFAULT '',
    item_name text,
    image_url text,
    popularity real,
    vote_count integer,
    first_seen date NOT NULL DEFAULT CURRENT_DATE,
    last_seen date NOT NULL DEFAULT CURRENT_DATE,
    expires_on date,
    deep_link text,
    CONSTRAINT title_availability_pkey PRIMARY KEY (item_id, item_type, region, provider_id, kind),
    CONSTRAINT title_availability_item_type_check CHECK (item_type IN ('movie', 'tv')),
    CONSTRAINT title_availability_kind_check CHECK (kind IN ('flatrate', 'free', 'ads', 'rent', 'buy'))
);

CREATE INDEX IF NOT EXISTS title_availability_region_provider_idx
  ON public.title_availability USING btree (region, provider_id, first_seen DESC);
CREATE INDEX IF NOT EXISTS title_availability_expiry_idx
  ON public.title_availability USING btree (region, expires_on) WHERE expires_on IS NOT NULL;

-- One row per (title, region) the job has looked at, whenever it last did.
-- Without it, a title added to a watchlist today whose offer has been there
-- for months would be announced as "arrived" on its first scan: a new row in
-- title_availability is only an arrival if the title was scanned before and
-- the offer was not there.
CREATE TABLE IF NOT EXISTS public.title_scans (
    item_id text NOT NULL,
    item_type text NOT NULL,
    region text NOT NULL,
    first_scan_on date NOT NULL DEFAULT CURRENT_DATE,
    last_scan_on date NOT NULL DEFAULT CURRENT_DATE,
    CONSTRAINT title_scans_pkey PRIMARY KEY (item_id, item_type, region)
);

CREATE TABLE IF NOT EXISTS public.catalog_scans (
    region text NOT NULL,
    provider_id integer NOT NULL,
    first_scan_on date NOT NULL DEFAULT CURRENT_DATE,
    last_scan_on date NOT NULL DEFAULT CURRENT_DATE,
    CONSTRAINT catalog_scans_pkey PRIMARY KEY (region, provider_id)
);

ALTER TABLE public.title_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.title_scans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.title_scans FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.title_scans TO service_role;

DROP POLICY IF EXISTS title_availability_select_public ON public.title_availability;
CREATE POLICY title_availability_select_public ON public.title_availability FOR SELECT USING (true);
DROP POLICY IF EXISTS catalog_scans_select_public ON public.catalog_scans;
CREATE POLICY catalog_scans_select_public ON public.catalog_scans FOR SELECT USING (true);

-- Supabase's default ACL hands every new table ALL to anon and authenticated
-- (090 found the same thing for functions), so the write privileges have to
-- be taken away explicitly rather than merely not granted.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.title_availability FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.catalog_scans FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.title_availability TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.title_availability TO service_role;
GRANT SELECT ON TABLE public.catalog_scans TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.catalog_scans TO service_role;

-- ── Verify ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF has_table_privilege('authenticated', 'public.title_availability', 'INSERT') THEN
    RAISE EXCEPTION 'authenticated can write title_availability';
  END IF;
  IF NOT has_table_privilege('anon', 'public.title_availability', 'SELECT') THEN
    RAISE EXCEPTION 'anon cannot read title_availability';
  END IF;
  RAISE NOTICE 'verified: availability snapshots are public to read, cron-only to write';
END $$;

COMMIT;
