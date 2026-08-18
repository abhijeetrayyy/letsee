-- 068_favourites_are_watched.sql
-- A favourite is a watched thing, retroactively.
--
-- Favourites and watched state were stored independently with nothing joining
-- them, so a profile could list a film among its favourites while its own
-- watched list denied ever seeing it. Onboarding made it routine: it asks for
-- four films you love and recorded that you had watched none of them.
--
-- The rule is now enforced at the only place a favourite is created
-- (/api/favoriteButton), so this repairs what accumulated before that.
--
-- Measured before running: 149 favourites, 10 with no status row at all,
-- 12 not flagged watched, across 2 users.
--
-- WHAT IT DELIBERATELY DOES NOT TOUCH: a favourite whose status is already
-- 'watching', 'on_hold' or 'dropped'. Three rows are in that state. Favouriting
-- episode three of something you abandoned is not a claim to have finished it,
-- and those statuses were set on purpose — overwriting a deliberate fact to
-- satisfy a rule is worse than the inconsistency it fixes.

BEGIN;

-- Give every favourite a status row, where it has none at all.
INSERT INTO public.user_media_status (user_id, item_id, item_type, item_name, image_url, genres, status)
SELECT f.user_id, f.item_id, f.item_type, f.item_name, f.image_url, f.genres, 'watched'
FROM public.favorite_items f
LEFT JOIN public.user_media_status s
  ON s.user_id = f.user_id AND s.item_id = f.item_id AND s.item_type = f.item_type
WHERE s.user_id IS NULL
ON CONFLICT (user_id, item_id, item_type) DO NOTHING;

-- And a watched_items row, which is what the diary and the profile grid read.
INSERT INTO public.watched_items (user_id, item_id, item_type, item_name, image_url, genres, is_watched)
SELECT f.user_id, f.item_id, f.item_type, f.item_name, f.image_url, f.genres, true
FROM public.favorite_items f
LEFT JOIN public.watched_items w
  ON w.user_id = f.user_id AND w.item_id = f.item_id AND w.item_type = f.item_type
WHERE w.user_id IS NULL
ON CONFLICT (user_id, item_id, item_type) DO NOTHING;

-- An existing row flagged not-watched is the "remove but keep my rating" path.
-- The favourite outliving that removal is the inconsistency being fixed, so the
-- flag goes back up; the rating and review it preserved are untouched.
UPDATE public.watched_items w
SET is_watched = true
FROM public.favorite_items f
WHERE w.user_id = f.user_id
  AND w.item_id = f.item_id
  AND w.item_type = f.item_type
  AND w.is_watched IS DISTINCT FROM true;

COMMIT;
