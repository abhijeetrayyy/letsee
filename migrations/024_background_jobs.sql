-- Migration 024: Background Job Queue
-- Allows scheduling and tracking async background jobs (availability alerts, digest emails, etc.)

-- Job status enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'job_status') then
    create type public.job_status as enum ('pending', 'running', 'completed', 'failed');
  end if;
end $$;

-- Job queue table
create table if not exists public.background_jobs (
  id bigserial primary key,
  job_type text not null,
  payload jsonb not null default '{}',
  status public.job_status not null default 'pending',
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  result jsonb,
  error text,
  scheduled_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists background_jobs_status_idx on public.background_jobs (status);
create index if not exists background_jobs_scheduled_idx on public.background_jobs (scheduled_at)
  where status = 'pending';
create index if not exists background_jobs_type_idx on public.background_jobs (job_type);

-- Notification preferences table
create table if not exists public.user_notification_prefs (
  user_id uuid primary key references public.users(id) on delete cascade,
  notify_streaming_changes boolean not null default false,
  notify_new_episodes boolean not null default false,
  notify_friend_activity boolean not null default false,
  notify_digest text not null default 'never' check (notify_digest in ('never', 'daily', 'weekly')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_user_notification_prefs_updated_at
before update on public.user_notification_prefs
for each row
execute function public.set_updated_at();

-- Track which watchlist items have had availability alerts sent
create table if not exists public.watchlist_alerts (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  item_id text not null,
  item_type text not null check (item_type in ('movie', 'tv')),
  provider_name text not null,
  alert_type text not null check (alert_type in ('added', 'removed', 'price_drop')),
  last_notified_at timestamptz not null default now(),
  unique (user_id, item_id, provider_name, alert_type)
);

create index if not exists watchlist_alerts_user_id_idx on public.watchlist_alerts (user_id);

-- RLS
alter table public.background_jobs enable row level security;
alter table public.user_notification_prefs enable row level security;
alter table public.watchlist_alerts enable row level security;

-- Admins can manage jobs; users can see their own
create policy "background_jobs_admin" on public.background_jobs
  for all using (auth.role() = 'service_role');

-- Users can manage their own notification prefs
create policy "notification_prefs_self" on public.user_notification_prefs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Users can view their own watchlist alerts
create policy "watchlist_alerts_self" on public.watchlist_alerts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
