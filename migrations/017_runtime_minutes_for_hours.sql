-- Add runtime_minutes so profile "Hours" stat can sum actual movie + TV episode runtimes
-- watched_items.runtime_minutes: for movies only (TV shows use episode runtimes)
-- watched_episodes.runtime_minutes: per episode (from TMDB when marking watched)
-- Safe to run even if tables do not exist yet (e.g. migrations run before full schema).

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'watched_items'
  ) then
    alter table public.watched_items
      add column if not exists runtime_minutes integer;
    comment on column public.watched_items.runtime_minutes is 'Movie runtime in minutes (from TMDB). Null for TV.';
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'watched_episodes'
  ) then
    alter table public.watched_episodes
      add column if not exists runtime_minutes integer;
    comment on column public.watched_episodes.runtime_minutes is 'Episode runtime in minutes (from TMDB).';
  end if;
end $$;
