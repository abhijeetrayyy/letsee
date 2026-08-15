-- 055: drop users.default_tv_status.
--
-- 021 added it for a flow that no longer exists: "when I add a TV show, mark
-- it as X". Back then adding a show was one action with one implied status,
-- so a per-user default made sense. It doesn't now — StatusControl offers all
-- five statuses explicitly and the episode modal applies the one you picked,
-- so there is no moment left where a default could apply.
--
-- Nothing read it. The two settings forms wrote it and read it back into
-- themselves, and the settings route stored it; no code path anywhere turned
-- it into a status. The label had also drifted into nonsense — "when I add a
-- TV show to Watched, set status to Watching".
--
-- 022's check constraint is dropped with the column (single-column checks go
-- with their column), but it is named explicitly first so the intent is on
-- the record rather than implied.
--
-- Every user held the default 'watching' at the time of writing, so this
-- discards no choice anyone made. It is still irreversible: re-adding the
-- column would give everyone the default again.
--
-- Note: 021 also described a `user_tv_list` table. It does not exist in the
-- live database and no code references it, so there is nothing to drop.

alter table public.users drop constraint if exists users_default_tv_status_check;
alter table public.users drop column if exists default_tv_status;
