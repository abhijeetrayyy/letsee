-- 057_watch_sessions.sql
-- A Tonight session: who's watching, under what constraints, and what they
-- decided.
--
-- Deliberately small, and deliberately *persisted* rather than held in the
-- client. Three reasons it can't be ephemeral state:
--
--   1. "Next" has to not repeat, across a reload and across participants.
--   2. The verdict has to write `watching` for everyone in the room, which
--      means the server needs an authoritative participant list it can trust
--      — not one posted by the client at decide time.
--   3. The votes are the only honest training signal this product will ever
--      get. A rejection at the moment of choosing, with the alternatives
--      known, is worth far more than a rating given a week later.
--
-- Sessions are not cleaned up on a schedule. They're small, they're the record
-- of how a decision was made, and `decided_item_id` makes an abandoned session
-- distinguishable from a completed one without a status column.

begin;

create table if not exists public.watch_sessions (
  id            bigserial primary key,
  created_by    uuid not null references public.users(id) on delete cascade,
  region        text not null default 'US',
  max_runtime   integer,
  media_type    text not null default 'any'
                check (media_type in ('any', 'movie', 'tv')),
  moods         text[] not null default '{}',
  allow_rewatch boolean not null default false,
  decided_item_id   text,
  decided_item_type text check (decided_item_type in ('movie', 'tv')),
  decided_at    timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists watch_sessions_creator_idx
  on public.watch_sessions (created_by, created_at desc);

create table if not exists public.watch_session_participants (
  session_id bigint not null references public.watch_sessions(id) on delete cascade,
  user_id    uuid   not null references public.users(id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (session_id, user_id)
);

create index if not exists watch_session_participants_user_idx
  on public.watch_session_participants (user_id);

-- One row per (participant, candidate). 'out' is what drives "Next" — a
-- rejected title is filtered from every later resolve in the same session, for
-- everyone, because one veto is enough.
create table if not exists public.watch_session_votes (
  session_id bigint not null references public.watch_sessions(id) on delete cascade,
  user_id    uuid   not null references public.users(id) on delete cascade,
  item_id    text   not null,
  item_type  text   not null check (item_type in ('movie', 'tv')),
  vote       text   not null check (vote in ('in', 'out')),
  created_at timestamptz not null default now(),
  primary key (session_id, user_id, item_id)
);

create index if not exists watch_session_votes_session_idx
  on public.watch_session_votes (session_id);

-- ── Membership helper ───────────────────────────────────────────────────────
-- A policy on watch_session_participants that itself selects from
-- watch_session_participants recurses forever. Same SECURITY DEFINER escape
-- hatch this codebase already uses for is_blocked(), is_club_member() and
-- profile_visible_to_viewer().
create or replace function public.is_session_participant(p_session bigint, p_user uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
      from public.watch_session_participants
     where session_id = p_session
       and user_id    = p_user
  );
$$;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.watch_sessions enable row level security;
alter table public.watch_session_participants enable row level security;
alter table public.watch_session_votes enable row level security;

drop policy if exists "watch_sessions_participant_read" on public.watch_sessions;
create policy "watch_sessions_participant_read"
  on public.watch_sessions
  for select
  using (public.is_session_participant(id, auth.uid()));

-- Only the creator mutates the session itself (constraints, verdict).
-- Participants read it and vote; they don't get to change the runtime limit
-- out from under whoever set it up.
drop policy if exists "watch_sessions_owner_write" on public.watch_sessions;
create policy "watch_sessions_owner_write"
  on public.watch_sessions
  for all
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

drop policy if exists "watch_session_participants_read" on public.watch_session_participants;
create policy "watch_session_participants_read"
  on public.watch_session_participants
  for select
  using (public.is_session_participant(session_id, auth.uid()));

drop policy if exists "watch_session_participants_owner_write" on public.watch_session_participants;
create policy "watch_session_participants_owner_write"
  on public.watch_session_participants
  for all
  using (
    exists (
      select 1 from public.watch_sessions s
       where s.id = session_id and s.created_by = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.watch_sessions s
       where s.id = session_id and s.created_by = auth.uid()
    )
  );

drop policy if exists "watch_session_votes_read" on public.watch_session_votes;
create policy "watch_session_votes_read"
  on public.watch_session_votes
  for select
  using (public.is_session_participant(session_id, auth.uid()));

-- You vote as yourself, in a session you're actually in.
drop policy if exists "watch_session_votes_self_write" on public.watch_session_votes;
create policy "watch_session_votes_self_write"
  on public.watch_session_votes
  for all
  using (auth.uid() = user_id and public.is_session_participant(session_id, auth.uid()))
  with check (auth.uid() = user_id and public.is_session_participant(session_id, auth.uid()));

commit;
