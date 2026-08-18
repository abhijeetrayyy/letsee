-- 067_rating_histogram_counts_everyone.sql
-- A community average that a private profile still counts toward.
--
-- `user_ratings_select_profile_visible` (019) gates SELECT on profile
-- visibility, which is correct for anything that names a person and wrong for
-- a number that names nobody. The effect was that switching a profile to
-- private silently removed that person's score from every title they had
-- rated — so the site's averages got quietly less representative as people
-- chose privacy, and no one could see it happening.
--
-- Verified before writing this: seeding one private rater took Interstellar's
-- histogram from 3 ratings to 2, and flipping them back to public restored it.
--
-- The split this introduces is the point. There are two different reads of one
-- table and they deserve different rules:
--
--   the histogram      answers "how did people rate this" — aggregate, no
--                      attribution, so everyone counts. This function.
--   the people lists   answer "who rated this" — attribution, so RLS decides,
--                      and the caller keeps reading the table directly.
--
-- SECURITY DEFINER is safe here for the same reason it is in 048: nothing
-- leaves this function that could be traced to a person. It returns ten counts.
-- `profile_show_ratings` is deliberately NOT consulted — that setting governs
-- whether a score is shown as YOURS, which is a question about attribution,
-- and this function attributes nothing.

BEGIN;

CREATE OR REPLACE FUNCTION public.title_rating_histogram(
  p_item_id text,
  p_item_type text
)
RETURNS TABLE (
  score smallint,
  count int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- generate_series, not a GROUP BY over the rows, so a score nobody gave
  -- comes back as a zero rather than as a missing bar the caller has to
  -- reconstruct.
  SELECT s::smallint AS score,
         COALESCE(c.n, 0)::int AS count
  FROM generate_series(1, 10) AS s
  LEFT JOIN (
    SELECT r.score AS sc, COUNT(*) AS n
    FROM public.user_ratings r
    WHERE r.item_id = p_item_id
      AND r.item_type = p_item_type
      AND r.score BETWEEN 1 AND 10
    GROUP BY r.score
  ) c ON c.sc = s
  ORDER BY s;
$$;

GRANT EXECUTE ON FUNCTION public.title_rating_histogram(text, text) TO authenticated, anon;

COMMIT;
