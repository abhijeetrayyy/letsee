-- Allow anyone to read watched_episodes so profile pages can show a user's TV/series progress to visitors

begin;

create policy "watched_episodes_select_public" on public.watched_episodes
  for select using (true);

commit;
