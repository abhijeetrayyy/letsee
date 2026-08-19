-- A rated activity row knows what it is about.
--
-- `log_rated_activity` looked the title up like this:
--
--     SELECT item_name, image_url INTO v_name, v_image
--     FROM public.user_media_status
--     WHERE user_id = NEW.user_id AND item_id = NEW.item_id
--
-- Rating something you have not shelved finds nothing, so the row was written
-- with `item_name` NULL — and the home feed renders exactly what the row says.
-- The result is a card with no title and a link to `/app/movie/77`, a URL that
-- names nothing.
--
-- The narrower key looks like the careful choice and is strictly worse. A
-- film's name is not a fact about the person who logged it; it is the same
-- string for everyone who holds it. The user's own row is still preferred,
-- because its `image_url` is the one they actually saw, but any row will do
-- rather than none.
--
-- Same shape of bug as `/api/reviews/popular` and `/api/feed/following`, both
-- fixed in application code in the same change. This is the one that was
-- writing bad rows rather than reading them.

CREATE OR REPLACE FUNCTION public.log_rated_activity() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_name text;
  v_image text;
BEGIN
  -- Only log a genuinely new score, not every re-save of the same value.
  IF TG_OP = 'UPDATE' AND OLD.score IS NOT DISTINCT FROM NEW.score THEN
    RETURN NEW;
  END IF;

  -- The rater's own row first: same title, and the poster they were looking at.
  SELECT item_name, image_url INTO v_name, v_image
  FROM public.user_media_status
  WHERE user_id = NEW.user_id AND item_id = NEW.item_id
  LIMIT 1;

  -- Then anyone's. A title rated but never shelved has no row of its own.
  IF v_name IS NULL THEN
    SELECT item_name, image_url INTO v_name, v_image
    FROM public.user_media_status
    WHERE item_id = NEW.item_id
      AND item_type = NEW.item_type
      AND item_name IS NOT NULL
    LIMIT 1;
  END IF;

  -- Then the diary, which carries the same two columns.
  IF v_name IS NULL THEN
    SELECT item_name, image_url INTO v_name, v_image
    FROM public.watched_items
    WHERE item_id = NEW.item_id
      AND item_type = NEW.item_type
      AND item_name IS NOT NULL
    LIMIT 1;
  END IF;

  INSERT INTO public.user_activity
    (user_id, activity_type, item_id, item_type, item_name, image_url, score, created_at)
  VALUES
    (NEW.user_id, 'rated', NEW.item_id, NEW.item_type, v_name, v_image, NEW.score, now());

  RETURN NEW;
END;
$$;

-- Rows already written without a name. Measured before writing this: one.
-- Left in place rather than deleted — somebody did rate that film, and the
-- activity is real even though the label was missing.
UPDATE public.user_activity a
SET item_name = COALESCE(a.item_name, s.item_name),
    image_url = COALESCE(a.image_url, s.image_url)
FROM public.user_media_status s
WHERE a.item_name IS NULL
  AND s.item_id = a.item_id
  AND s.item_type = a.item_type
  AND s.item_name IS NOT NULL;

UPDATE public.user_activity a
SET item_name = COALESCE(a.item_name, w.item_name),
    image_url = COALESCE(a.image_url, w.image_url)
FROM public.watched_items w
WHERE a.item_name IS NULL
  AND w.item_id = a.item_id
  AND w.item_type = a.item_type
  AND w.item_name IS NOT NULL;

DO $$
DECLARE
  remaining int;
BEGIN
  SELECT count(*) INTO remaining
  FROM public.user_activity
  WHERE item_name IS NULL AND item_id IS NOT NULL;

  -- Not an error. A title nobody in the database has ever named cannot be
  -- backfilled from the database; the feed still renders those as "a title".
  RAISE NOTICE 'user_activity rows still without a name: %', remaining;
END;
$$;
