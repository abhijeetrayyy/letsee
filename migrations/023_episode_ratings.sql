-- Create episode_ratings table
create table if not exists public.episode_ratings (
  user_id uuid not null references auth.users(id) on delete cascade,
  show_id text not null,
  season_number int not null,
  episode_number int not null,
  score int check (score >= 1 and score <= 10),
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  primary key (user_id, show_id, season_number, episode_number)
);

-- RLS Policies
alter table public.episode_ratings enable row level security;

create policy "Users can view their own episode ratings"
  on public.episode_ratings for select
  using (auth.uid() = user_id);

create policy "Users can insert/update their own episode ratings"
  on public.episode_ratings for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own episode ratings"
  on public.episode_ratings for update
  using (auth.uid() = user_id);

create policy "Users can delete their own episode ratings"
  on public.episode_ratings for delete
  using (auth.uid() = user_id);

-- Add updated_at trigger
create trigger set_timestamp
  before update on public.episode_ratings
  for each row
  execute procedure trigger_set_timestamp();
