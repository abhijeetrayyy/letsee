-- 035_comments.sql
-- Comment threads on movies, TV shows, and reviews

BEGIN;

CREATE TABLE IF NOT EXISTS public.comments (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('movie', 'tv', 'review')),
  parent_id BIGINT REFERENCES public.comments(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) >= 1 AND char_length(body) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS comments_item_idx ON public.comments (item_id, item_type, created_at DESC);
CREATE INDEX IF NOT EXISTS comments_user_idx ON public.comments (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS comments_parent_idx ON public.comments (parent_id) WHERE parent_id IS NOT NULL;

CREATE TRIGGER set_comments_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_select_public" ON public.comments FOR SELECT USING (true);
CREATE POLICY "comments_insert_self" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_update_self" ON public.comments FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_delete_self" ON public.comments FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.notify_comment_reply()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE parent_owner UUID; item_owner UUID;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    SELECT user_id INTO parent_owner FROM public.comments WHERE id = NEW.parent_id;
    IF parent_owner IS NOT NULL AND parent_owner != NEW.user_id THEN
      INSERT INTO public.notifications (user_id, actor_id, notification_type, target_type, target_id, metadata)
      VALUES (parent_owner, NEW.user_id, 'comment_reply', 'comment', NEW.id,
              jsonb_build_object('comment_body', left(NEW.body, 100), 'item_id', NEW.item_id, 'item_type', NEW.item_type));
    END IF;
  END IF;
  IF NEW.item_type = 'review' THEN
    SELECT user_id INTO item_owner FROM public.watched_items WHERE id = NEW.item_id::bigint;
    IF item_owner IS NOT NULL AND item_owner != NEW.user_id AND item_owner != parent_owner THEN
      INSERT INTO public.notifications (user_id, actor_id, notification_type, target_type, target_id, metadata)
      VALUES (item_owner, NEW.user_id, 'comment_reply', 'comment', NEW.id,
              jsonb_build_object('comment_body', left(NEW.body, 100), 'item_id', NEW.item_id, 'item_type', NEW.item_type));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_comment_reply AFTER INSERT ON public.comments FOR EACH ROW EXECUTE FUNCTION public.notify_comment_reply();
COMMIT;
