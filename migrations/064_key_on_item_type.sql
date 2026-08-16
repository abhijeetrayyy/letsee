-- 064_key_on_item_type.sql
-- A film and a series can share a TMDB id. The keys said otherwise.
--
-- TMDB numbers movies and TV independently, so id 550 is Fight Club *and* a
-- completely unrelated series. Five tables carry an `item_type` column and
-- then key on `(user_id, item_id)` alone, which means one user cannot hold
-- both — the second write silently overwrites the first, and the row that
-- survives claims the other one's name, poster and genres.
--
-- Low ids collide most, and low ids are the famous films: exactly the titles a
-- library is most likely to contain. Nobody would report this as a bug either;
-- it looks like a title you tracked simply changing into a different one.
--
-- ── Why this is safe on existing data ──────────────────────────────────────
-- Widening a uniqueness constraint can only ever *permit* more rows. Anything
-- unique on (user_id, item_id) is still unique on (user_id, item_id,
-- item_type), so no current row can violate the new key and the migration
-- cannot fail on data. It is strictly a relaxation.
--
-- ── The deployment hazard, which is real ───────────────────────────────────
-- Postgres requires an upsert's ON CONFLICT target to name an actual unique
-- constraint. The moment the old constraint goes, every
-- `onConflict: "user_id,item_id"` in the app starts failing — and there are
-- sixteen of them. **Apply this together with the deploy that updates them,
-- not before.** The matching code change is in the same commit.

begin;

-- ── user_media_status: a real PRIMARY KEY, from 029 ─────────────────────────
alter table public.user_media_status
  drop constraint if exists user_media_status_pkey;

alter table public.user_media_status
  add primary key (user_id, item_id, item_type);

-- ── The four unique constraints ─────────────────────────────────────────────
-- Dropped by looking up the constraint that actually covers exactly
-- (user_id, item_id) rather than by guessing its generated name, which differs
-- between tables created inline and tables altered later.
do $$
declare
  r record;
begin
  for r in
    select c.conrelid::regclass::text as tbl, c.conname
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
     where n.nspname = 'public'
       and c.contype = 'u'
       and t.relname in ('watched_items', 'favorite_items', 'user_ratings', 'user_watchlist')
       and (
         select array_agg(a.attname order by a.attname)
           from unnest(c.conkey) k
           join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k
       ) = array['item_id', 'user_id']
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    raise notice 'dropped % on %', r.conname, r.tbl;
  end loop;
end $$;

alter table public.watched_items
  add constraint watched_items_user_item_type_key unique (user_id, item_id, item_type);
alter table public.favorite_items
  add constraint favorite_items_user_item_type_key unique (user_id, item_id, item_type);
alter table public.user_ratings
  add constraint user_ratings_user_item_type_key unique (user_id, item_id, item_type);
alter table public.user_watchlist
  add constraint user_watchlist_user_item_type_key unique (user_id, item_id, item_type);

commit;
