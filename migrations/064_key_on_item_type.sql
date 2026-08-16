-- 064_key_on_item_type.sql
-- A film and a series can share a TMDB id. The keys said otherwise.
--
-- TMDB numbers movies and TV independently, so id 550 is Fight Club *and* a
-- completely unrelated series. Several tables carry an `item_type` column and
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
-- item_type), so no current row can violate the new key and this cannot fail
-- on data. It is strictly a relaxation.
--
-- ── The deployment hazard, which is real ───────────────────────────────────
-- Postgres requires an upsert's ON CONFLICT target to name an actual unique
-- constraint. The moment the old constraint goes, every
-- `onConflict: "user_id,item_id"` fails — and the app has sixteen. The code
-- half shipped in the same commit as this file, so **the app is broken until
-- this runs.**
--
-- ── Written defensively, because the first attempt failed twice ────────────
-- v1 compared `array_agg(a.attname)` against a text[] literal and died on
-- `operator does not exist: name[] = text[]` — attname is `name`, not `text`.
-- It also named `user_watchlist`, which 029 migrated away from and which no
-- longer exists. Both mistakes came from asserting the schema instead of
-- asking it. This version asks: it discovers the tables that are actually
-- present and the constraints that are actually there, by shape rather than
-- by name, and skips anything missing. Re-running it is a no-op.

begin;

do $$
declare
  t          text;
  con        text;
  kind       "char";
  has_type   boolean;
begin
  foreach t in array array['user_media_status', 'watched_items', 'favorite_items',
                           'user_ratings', 'user_watchlist']
  loop
    -- Skip tables this database doesn't have. 029 moved everything off
    -- user_watchlist, so it is absent here but may exist elsewhere.
    if to_regclass('public.' || t) is null then
      raise notice 'skip %: table not present', t;
      continue;
    end if;

    -- And skip anything without an item_type to key on.
    select exists (
      select 1 from pg_attribute a
       where a.attrelid = to_regclass('public.' || t)
         and a.attname = 'item_type'
         and a.attnum > 0
         and not a.attisdropped
    ) into has_type;

    if not has_type then
      raise notice 'skip %: no item_type column', t;
      continue;
    end if;

    -- Find the existing key over exactly (user_id, item_id), whether it is a
    -- primary key or a unique constraint, by its columns rather than by a
    -- generated name that differs between tables.
    select c.conname, c.contype into con, kind
      from pg_constraint c
      join pg_class cl on cl.oid = c.conrelid
      join pg_namespace n on n.oid = cl.relnamespace
     where n.nspname = 'public'
       and cl.relname::text = t
       and c.contype in ('p', 'u')
       and array_length(c.conkey, 1) = 2
       and exists (
         select 1 from unnest(c.conkey) k
          join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k
         where a.attname = 'user_id')
       and exists (
         select 1 from unnest(c.conkey) k
          join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k
         where a.attname = 'item_id')
     limit 1;

    if con is null then
      raise notice 'skip %: no (user_id, item_id) key found — already widened?', t;
      continue;
    end if;

    execute format('alter table public.%I drop constraint %I', t, con);

    -- Put back the same KIND of constraint. user_media_status keys on a real
    -- PRIMARY KEY (029); swapping it for a plain UNIQUE would leave the table
    -- without one, which changes its replica identity and what Supabase
    -- realtime will do with it. A unique constraint alone is enough for
    -- ON CONFLICT, so the breakage would have been silent and elsewhere.
    if kind = 'p' then
      execute format('alter table public.%I add primary key (user_id, item_id, item_type)', t);
      raise notice 'widened %: primary key (was %)', t, con;
    else
      execute format(
        'alter table public.%I add constraint %I unique (user_id, item_id, item_type)',
        t, t || '_user_item_type_key');
      raise notice 'widened %: unique (was %)', t, con;
    end if;
  end loop;
end $$;

commit;
