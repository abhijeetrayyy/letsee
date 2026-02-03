-- Profile visibility toggles: show diary, ratings, and public reviews on profile
-- Default true so existing users keep current behavior.

alter table public.users add column if not exists profile_show_diary boolean not null default true;
alter table public.users add column if not exists profile_show_ratings boolean not null default true;
alter table public.users add column if not exists profile_show_public_reviews boolean not null default true;

comment on column public.users.profile_show_diary is 'When true, visitors who can see the profile see diary (review_text) on watched cards.';
comment on column public.users.profile_show_ratings is 'When true, visitors see ratings on profile.';
comment on column public.users.profile_show_public_reviews is 'When true, visitors see public review snippets on profile.';
