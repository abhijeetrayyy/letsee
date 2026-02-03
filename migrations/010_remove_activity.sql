-- Remove user activity feature: table, index, RLS policies, and enum.
-- Activity was only used for the home-page "Activity" feed (you + people you follow).
-- Run after deploying code that no longer references activity.

begin;

drop policy if exists "activity_insert_self" on public.activity;
drop policy if exists "activity_select_self_or_following" on public.activity;
drop table if exists public.activity;
drop type if exists public.activity_type;

commit;
