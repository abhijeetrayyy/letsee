-- 058_letterboxd_import.sql
-- Importing a Letterboxd history.
--
-- Export already exists (/api/account/export); this is the other half. Export
-- removes the reason not to try us, import removes the cost of switching, and
-- neither is worth much without the other.
--
-- ── Why not background_jobs (024) ───────────────────────────────────────────
-- The plan called for running this on the existing job queue. That queue is a
-- shell: nothing anywhere calls registerJobHandler, so dispatchJob always fails
-- with "No handler registered", and vercel.json declares no crons, so
-- /api/cron/run-jobs is never invoked. Even fixed, cron granularity means an
-- import that starts "sometime later" — which is the wrong shape for the one
-- moment it matters, a new user with an empty profile deciding whether to stay.
--
-- So the work is chunked and client-driven: the browser posts the file once,
-- then calls /process repeatedly until done, with a real progress bar. That
-- also keeps each request inside serverless time limits without a queue.
--
-- ── Why one row per film, not per CSV line ──────────────────────────────────
-- watched.csv, ratings.csv, reviews.csv and likes/films.csv all name the same
-- films. Deduping on (title, year) at insert time means a film costs ONE TMDB
-- lookup instead of four, which is the difference between a 500-film import
-- being pleasant and being a rate-limit problem.

begin;

create table if not exists public.import_jobs (
  id             bigserial primary key,
  user_id        uuid not null references public.users(id) on delete cascade,
  source         text not null default 'letterboxd',
  status         text not null default 'pending'
                 check (status in ('pending', 'processing', 'completed', 'failed')),
  total_rows     integer not null default 0,
  processed_rows integer not null default 0,
  resolved_rows  integer not null default 0,
  error          text,
  created_at     timestamptz not null default now(),
  completed_at   timestamptz
);

create index if not exists import_jobs_user_idx
  on public.import_jobs (user_id, created_at desc);

create table if not exists public.import_rows (
  id       bigserial primary key,
  job_id   bigint not null references public.import_jobs(id) on delete cascade,

  -- What Letterboxd said. Kept verbatim so an unresolved row can be shown to
  -- the user as they wrote it, and re-matched by hand.
  title          text not null,
  year           integer,
  letterboxd_uri text,

  -- Accumulated intent across the export's several files.
  watched      boolean not null default false,
  watchlist    boolean not null default false,
  favorite     boolean not null default false,
  rating       smallint check (rating between 1 and 10),
  review_text  text,
  watched_date date,

  -- Resolution. 'unresolved' is a first-class outcome, not a failure: guessing
  -- silently would put films in someone's history that they never saw.
  status        text not null default 'pending'
                check (status in ('pending', 'applied', 'unresolved', 'skipped')),
  tmdb_id       text,
  tmdb_type     text check (tmdb_type in ('movie', 'tv')),
  matched_title text
);

create index if not exists import_rows_job_status_idx
  on public.import_rows (job_id, status);

-- Postgres treats NULLs as distinct in a unique constraint, so a film with no
-- year would dedupe against nothing. coalesce in an expression index fixes it.
create unique index if not exists import_rows_job_title_year_idx
  on public.import_rows (job_id, lower(title), coalesce(year, 0));

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Self-only, both tables. Deliberately NOT the service_role-only policy that
-- background_jobs uses: the whole point is that the importing user polls their
-- own progress, which a service_role-gated table can't serve without routing
-- every poll through an admin client.
alter table public.import_jobs enable row level security;
alter table public.import_rows enable row level security;

drop policy if exists "import_jobs_self" on public.import_jobs;
create policy "import_jobs_self"
  on public.import_jobs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.owns_import_job(p_job bigint)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.import_jobs j
     where j.id = p_job and j.user_id = auth.uid()
  );
$$;

drop policy if exists "import_rows_self" on public.import_rows;
create policy "import_rows_self"
  on public.import_rows
  for all
  using (public.owns_import_job(job_id))
  with check (public.owns_import_job(job_id));

commit;
