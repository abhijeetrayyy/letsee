-- 043_taste_matching.sql
-- Rarity-weighted taste matching.
--
-- Replaces genre-cosine similarity, whose discriminative power *decreases* as
-- people watch more: with ~20 genres everyone ends up Drama/Thriller/Comedy
-- dominant and scores ~85% against everyone else. "You both like Drama" is
-- also not a signal any human recognises as a reason to talk to a stranger.
--
-- Instead we score shared *titles*, weighted by how rare each title is in the
-- community (IDF). "You're 2 of only 3 people here who've seen Turtles Can
-- Fly" is a real social signal, and it works BETTER at low user counts, not
-- worse.
--
--   idf(t)   = ln(1 + U / n_t)          U = users with >=1 title, n_t = users with t
--   w_u(t)   = 1.0 watched/watching + 0.5 favorited + 0.3 rated>=8
--   agree(t) = 1 - |r_a - r_b| / 9      when both rated t, else 1
--   raw      = SUM over shared titles of  w_a * w_b * idf^2 * agree
--   sim      = raw / (||a|| * ||b||)    cosine normalisation
--   final    = sim * |S| / (|S| + 3)    shrinkage, so one shared film != 100%
--
-- idf is squared (Adamic-Adar style) because a title only carries signal when
-- it is rare for BOTH users.

BEGIN;

-- ── Indexes required by the title-overlap join ──────────────────────────────
-- All three tables were indexed on user_id only; the join here is on the item.
CREATE INDEX IF NOT EXISTS user_media_status_item_idx
  ON public.user_media_status (item_id, item_type);
CREATE INDEX IF NOT EXISTS favorite_items_item_idx
  ON public.favorite_items (item_id, item_type);
CREATE INDEX IF NOT EXISTS user_ratings_item_idx
  ON public.user_ratings (item_id, item_type);

-- ── Unified engagement signal ───────────────────────────────────────────────
-- One row per (user, title) with a summed weight. user_media_status is the
-- base because it has a (user_id, item_id) PK and covers the whole lifecycle;
-- watched_items is diary/review storage and would double-count rewatches.
CREATE OR REPLACE VIEW public.user_title_affinity AS
SELECT
  user_id,
  item_type,
  item_id,
  max(item_name) FILTER (WHERE item_name IS NOT NULL) AS item_name,
  sum(w) AS weight
FROM (
  SELECT user_id, item_type, item_id, item_name, 1.0::numeric AS w
    FROM public.user_media_status
   WHERE status IN ('watched', 'watching')
  UNION ALL
  SELECT user_id, item_type, item_id, item_name, 0.5::numeric
    FROM public.favorite_items
  UNION ALL
  SELECT user_id, item_type, item_id, NULL::text, 0.3::numeric
    FROM public.user_ratings
   WHERE score >= 8
) s
GROUP BY user_id, item_type, item_id;

-- Internal only: the SECURITY DEFINER functions below read it. Clients must
-- not query it directly (it spans every user's library).
REVOKE ALL ON public.user_title_affinity FROM anon, authenticated;

-- ── Ranked matches for one user ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.taste_matches(p_user uuid, p_limit int DEFAULT 10)
RETURNS TABLE (
  user_id uuid,
  username text,
  avatar_url text,
  about text,
  score numeric,
  shared_count int,
  top_shared jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH totals AS (
    SELECT count(DISTINCT a.user_id)::numeric AS n_users FROM user_title_affinity a
  ),
  idf AS (
    SELECT a.item_type, a.item_id,
           ln(1 + (SELECT n_users FROM totals) / count(DISTINCT a.user_id)::numeric) AS idf,
           count(DISTINCT a.user_id)::int AS viewers
    FROM user_title_affinity a
    GROUP BY a.item_type, a.item_id
  ),
  norms AS (
    SELECT a.user_id, sqrt(sum((a.weight * i.idf) ^ 2)) AS nrm
    FROM user_title_affinity a
    JOIN idf i ON i.item_type = a.item_type AND i.item_id = a.item_id
    GROUP BY a.user_id
  ),
  mine AS (
    SELECT a.item_type, a.item_id, a.weight, i.idf, i.viewers
    FROM user_title_affinity a
    JOIN idf i ON i.item_type = a.item_type AND i.item_id = a.item_id
    WHERE a.user_id = p_user
  ),
  candidates AS (
    SELECT u.id, u.username, u.avatar_url, u.about
    FROM users u
    WHERE u.id <> p_user
      AND u.visibility = 'public'
      AND u.username IS NOT NULL
      AND u.username <> ''
      AND NOT public.is_blocked(p_user, u.id)
  ),
  pairs AS (
    SELECT
      t.user_id,
      m.weight * t.weight * m.idf * m.idf
        * COALESCE(1 - abs(mr.score - tr.score) / 9.0, 1) AS contrib,
      m.idf,
      m.viewers,
      COALESCE(t.item_name, m2.item_name, '') AS item_name,
      t.item_type,
      t.item_id
    FROM mine m
    JOIN user_title_affinity t
      ON t.item_type = m.item_type AND t.item_id = m.item_id AND t.user_id <> p_user
    JOIN candidates c ON c.id = t.user_id
    LEFT JOIN user_title_affinity m2
      ON m2.user_id = p_user AND m2.item_type = m.item_type AND m2.item_id = m.item_id
    LEFT JOIN user_ratings mr
      ON mr.user_id = p_user AND mr.item_type = m.item_type AND mr.item_id = m.item_id
    LEFT JOIN user_ratings tr
      ON tr.user_id = t.user_id AND tr.item_type = t.item_type AND tr.item_id = t.item_id
  ),
  agg AS (
    SELECT
      p.user_id,
      sum(p.contrib) AS raw,
      count(*)::int AS shared_count,
      (array_agg(
        jsonb_build_object(
          'itemId', p.item_id,
          'itemType', p.item_type,
          'name', p.item_name,
          'rarity', round(p.idf, 3),
          'viewers', p.viewers,
          'totalUsers', (SELECT n_users::int FROM totals)
        ) ORDER BY p.idf DESC, p.item_name
      ))[1:3] AS top3
    FROM pairs p
    GROUP BY p.user_id
  )
  SELECT
    c.id,
    c.username,
    c.avatar_url,
    c.about,
    round(
      (a.raw / NULLIF((SELECT nrm FROM norms WHERE norms.user_id = p_user) * n.nrm, 0))
        * (a.shared_count::numeric / (a.shared_count + 3)),
      4
    ) AS score,
    a.shared_count,
    to_jsonb(a.top3) AS top_shared
  FROM agg a
  JOIN candidates c ON c.id = a.user_id
  JOIN norms n ON n.user_id = a.user_id
  WHERE a.raw > 0
  ORDER BY score DESC NULLS LAST, a.shared_count DESC
  LIMIT greatest(p_limit, 1);
$$;

-- ── Pairwise score for two users (profile page) ─────────────────────────────
CREATE OR REPLACE FUNCTION public.taste_compatibility(p_a uuid, p_b uuid)
RETURNS TABLE (score numeric, shared_count int, top_shared jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH totals AS (
    SELECT count(DISTINCT a.user_id)::numeric AS n_users FROM user_title_affinity a
  ),
  idf AS (
    SELECT a.item_type, a.item_id,
           ln(1 + (SELECT n_users FROM totals) / count(DISTINCT a.user_id)::numeric) AS idf,
           count(DISTINCT a.user_id)::int AS viewers
    FROM user_title_affinity a
    GROUP BY a.item_type, a.item_id
  ),
  norms AS (
    SELECT a.user_id, sqrt(sum((a.weight * i.idf) ^ 2)) AS nrm
    FROM user_title_affinity a
    JOIN idf i ON i.item_type = a.item_type AND i.item_id = a.item_id
    WHERE a.user_id IN (p_a, p_b)
    GROUP BY a.user_id
  ),
  pairs AS (
    SELECT
      x.weight * y.weight * i.idf * i.idf
        * COALESCE(1 - abs(rx.score - ry.score) / 9.0, 1) AS contrib,
      i.idf,
      i.viewers,
      COALESCE(x.item_name, y.item_name, '') AS item_name,
      x.item_type, x.item_id
    FROM user_title_affinity x
    JOIN user_title_affinity y
      ON y.item_type = x.item_type AND y.item_id = x.item_id AND y.user_id = p_b
    JOIN idf i ON i.item_type = x.item_type AND i.item_id = x.item_id
    LEFT JOIN user_ratings rx
      ON rx.user_id = p_a AND rx.item_type = x.item_type AND rx.item_id = x.item_id
    LEFT JOIN user_ratings ry
      ON ry.user_id = p_b AND ry.item_type = x.item_type AND ry.item_id = x.item_id
    WHERE x.user_id = p_a
  )
  SELECT
    round(
      (COALESCE(sum(p.contrib), 0)
        / NULLIF(
            (SELECT nrm FROM norms WHERE norms.user_id = p_a)
            * (SELECT nrm FROM norms WHERE norms.user_id = p_b), 0))
        * (count(*)::numeric / (count(*) + 3)),
      4
    ) AS score,
    count(*)::int AS shared_count,
    to_jsonb((array_agg(
      jsonb_build_object(
        'itemId', p.item_id,
        'itemType', p.item_type,
        'name', p.item_name,
        'rarity', round(p.idf, 3),
        'viewers', p.viewers,
        'totalUsers', (SELECT n_users::int FROM totals)
      ) ORDER BY p.idf DESC, p.item_name
    ))[1:3]) AS top_shared
  FROM pairs p;
$$;

GRANT EXECUTE ON FUNCTION public.taste_matches(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.taste_compatibility(uuid, uuid) TO authenticated, anon;

COMMIT;
