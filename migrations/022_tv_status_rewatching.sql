-- Migration: Add 'rewatching' to user_tv_list status check constraint

-- 1. Drop existing check constraint
ALTER TABLE public.user_tv_list DROP CONSTRAINT IF EXISTS user_tv_list_status_check;

-- 2. Add new check constraint with 'rewatching'
ALTER TABLE public.user_tv_list
ADD CONSTRAINT user_tv_list_status_check
CHECK (status IN ('watching', 'completed', 'on_hold', 'dropped', 'plan_to_watch', 'rewatching'));

-- 3. Also update users default_tv_status check
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_default_tv_status_check;

ALTER TABLE public.users
ADD CONSTRAINT users_default_tv_status_check
CHECK (default_tv_status IN ('watching', 'completed', 'on_hold', 'dropped', 'plan_to_watch', 'rewatching'));
