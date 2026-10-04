-- 116: a review copy with no published review behind it goes private.
--
-- `watched_items.public_review_text` is the copy `takes` keeps for old
-- readers. Copies can outlive the review: the owner's Interstellar still
-- carried "probe: kept private" (from 17 Aug 2026) long after its take had
-- become private with no words, and that copy was readable by anyone who could
-- see the profile — on the review page, in profile data, and in the
-- "reviewed" activity row `trg_log_reviewed_activity` wrote from it.
--
-- The review page and the Reviews list now read the published take
-- (src/utils/publishedReviews.ts). This removes what was already copied:
--   * the words are kept, as the private diary note (`review_text`) — added
--     to an existing note rather than replacing it;
--   * the public copy is cleared;
--   * the "reviewed" activity row carrying those exact words is removed.
-- Clearing the copy fires no new activity (the trigger only logs a non-null
-- public text). Dry-run on 4 Oct 2026 against production: one row (the owner's
-- Interstellar), one activity row; WeCrashed, a real published review, kept.

begin;

create temp table stale on commit drop as
  select w.id, w.user_id, w.item_id, w.item_type, w.public_review_text
  from public.watched_items w
  where w.public_review_text is not null
    and not exists (
      select 1 from public.takes t
       where t.user_id = w.user_id and t.item_id = w.item_id and t.item_type = w.item_type
         and t.scope = 'title' and t.is_public and t.body is not null and btrim(t.body) <> ''
    );

update public.watched_items w
   set review_text = case
         when w.review_text is null or btrim(w.review_text) = '' then s.public_review_text
         when position(s.public_review_text in w.review_text) > 0 then w.review_text
         else w.review_text || E'\n\n' || s.public_review_text
       end,
       public_review_text = null
  from stale s
 where w.id = s.id;

delete from public.user_activity a
 using stale s
 where a.user_id = s.user_id and a.item_id = s.item_id and a.item_type = s.item_type
   and a.activity_type = 'reviewed' and a.review_text = s.public_review_text;

commit;
