-- 071_dm_notification_cleanup.sql
-- A deleted message takes its notification with it.
--
-- 044 raises a dm_received notification on INSERT and nothing ever removed it,
-- so deleting a message left the bell counting something that no longer
-- exists. Hit twice during development by deleting test messages; a user
-- deleting a real one hits it the same way.
--
-- The obstacle is that 044 records no link back to the message — only
-- user_id, actor_id and the type — so on DELETE there is nothing exact to
-- match. Both halves of that are fixed here.

BEGIN;

/**
 * Record which message raised the notification.
 *
 * `metadata` already exists and is already used this way by other notification
 * types, so this needs no schema change — it just stops throwing away the one
 * fact that makes the row reversible.
 */
CREATE OR REPLACE FUNCTION public.notify_dm_received()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.sender_id = NEW.recipient_id THEN
    RETURN NEW;
  END IF;
  IF public.is_blocked(NEW.sender_id, NEW.recipient_id) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, actor_id, notification_type, metadata, created_at)
  VALUES (
    NEW.recipient_id,
    NEW.sender_id,
    'dm_received',
    jsonb_build_object('message_id', NEW.id),
    now()
  );

  RETURN NEW;
END;
$$;

/**
 * Remove the notification when its message goes.
 *
 * Two rules, because rows written before this migration carry no message_id
 * and must not be stranded:
 *
 *   exact    — the notification naming this message id. Precise, and the only
 *              rule that will apply once the backlog ages out.
 *   fallback — for rows with no message_id, only clear them when NO messages
 *              from that sender to that recipient remain. Deleting one message
 *              out of a conversation must not silently clear notifications
 *              that still refer to messages sitting in the thread.
 *
 * SECURITY DEFINER for the same reason as the insert side: the row being
 * cleaned belongs to the recipient, who is not the person doing the deleting.
 */
CREATE OR REPLACE FUNCTION public.cleanup_dm_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.notifications n
  WHERE n.notification_type = 'dm_received'
    AND n.user_id = OLD.recipient_id
    AND n.actor_id = OLD.sender_id
    AND (
      (n.metadata ->> 'message_id') = OLD.id::text
      OR (
        n.metadata ->> 'message_id' IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.messages m
          WHERE m.sender_id = OLD.sender_id
            AND m.recipient_id = OLD.recipient_id
            AND m.id <> OLD.id
        )
      )
    );

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_dm_notification ON public.messages;
CREATE TRIGGER trg_cleanup_dm_notification AFTER DELETE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.cleanup_dm_notification();

/**
 * Clear the orphans already there: dm_received rows whose sender has no
 * surviving message to this recipient. Cheap now, and it means the bell starts
 * from the truth rather than from an accumulated backlog.
 */
DELETE FROM public.notifications n
WHERE n.notification_type = 'dm_received'
  AND NOT EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.sender_id = n.actor_id
      AND m.recipient_id = n.user_id
  );

COMMIT;
