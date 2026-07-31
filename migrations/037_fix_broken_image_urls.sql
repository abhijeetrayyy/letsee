-- 037_fix_broken_image_urls.sql
-- Fix image URLs that are missing the TMDB base prefix
-- Run this in Supabase SQL Editor

BEGIN;

UPDATE public.user_media_status
SET image_url = 'https://image.tmdb.org/t/p/w342' || image_url
WHERE image_url LIKE '/%'
AND image_url NOT LIKE 'http%';

-- Also fix any broken images in favorite_items
UPDATE public.favorite_items
SET image_url = 'https://image.tmdb.org/t/p/w342' || image_url
WHERE image_url LIKE '/%'
AND image_url NOT LIKE 'http%';

-- And watched_items
UPDATE public.watched_items
SET image_url = 'https://image.tmdb.org/t/p/w342' || image_url
WHERE image_url LIKE '/%'
AND image_url NOT LIKE 'http%';

COMMIT;
