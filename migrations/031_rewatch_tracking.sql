-- 031_rewatch_tracking.sql
-- Adds rewatch tracking to user_media_status

BEGIN;

-- Add watch_count column to track how many times a user has watched something
ALTER TABLE public.user_media_status
  ADD COLUMN IF NOT EXISTS watch_count INTEGER NOT NULL DEFAULT 1;

-- Create rewatch history table for detailed tracking
CREATE TABLE IF NOT EXISTS public.watch_history (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('movie', 'tv')),
  watched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  watch_number INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS watch_history_user_id_idx ON public.watch_history (user_id, watched_at DESC);
CREATE INDEX IF NOT EXISTS watch_history_user_item_idx ON public.watch_history (user_id, item_id);

-- Function to record a rewatch and auto-increment the counter
CREATE OR REPLACE FUNCTION public.record_rewatch(
  p_user_id UUID,
  p_item_id TEXT,
  p_item_type TEXT
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  current_count INTEGER;
BEGIN
  SELECT watch_count INTO current_count
  FROM public.user_media_status
  WHERE user_id = p_user_id AND item_id = p_item_id;

  IF current_count IS NULL THEN
    -- First time watching
    INSERT INTO public.user_media_status (user_id, item_id, item_type, status, watch_count, updated_at)
    VALUES (p_user_id, p_item_id, p_item_type, 'watched', 1, now())
    ON CONFLICT (user_id, item_id) DO NOTHING;
  ELSE
    -- Rewatch: bump counter
    UPDATE public.user_media_status
    SET watch_count = watch_count + 1, updated_at = now()
    WHERE user_id = p_user_id AND item_id = p_item_id;
  END IF;

  -- Always insert into history
  INSERT INTO public.watch_history (user_id, item_id, item_type, watch_number)
  VALUES (p_user_id, p_item_id, p_item_type, COALESCE(current_count, 0) + 1);
END;
$$;

-- RLS
ALTER TABLE public.watch_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "watch_history_self"
  ON public.watch_history
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "watch_history_profile_visible"
  ON public.watch_history
  FOR SELECT
  USING (public.profile_visible_to_viewer(user_id));

COMMIT;
