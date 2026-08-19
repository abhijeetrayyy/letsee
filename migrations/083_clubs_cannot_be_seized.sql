-- 083_clubs_cannot_be_seized.sql
-- Four ways to take over a club you do not run, and one decorative join policy.
--
-- ── 1. Anyone can make themselves owner of any club ────────────────────────
--
-- 049's insert policy constrains who the row is ABOUT and nothing about what it
-- CLAIMS:
--   CREATE POLICY club_members_insert_self ON public.club_members
--     FOR INSERT WITH CHECK (auth.uid() = user_id);
-- while `role` and `status` are ordinary columns whose CHECK constraints happily
-- permit 'owner' and 'active'. So:
--   POST /rest/v1/club_members
--   {"club_id":1,"user_id":"<self>","role":"owner","status":"active"}
-- is instant administration of any club on the platform — rename it, replace the
-- weekly pick every member sees, promote accomplices, remove every other member.
-- The API route carefully hardcodes `role: "member"`; the policy behind it never
-- looked.
--
-- ── 2. A moderator can promote themselves to owner ─────────────────────────
--
--   CREATE POLICY club_members_update_admin ON public.club_members
--     FOR UPDATE USING (public.is_club_admin(club_id, auth.uid()));
-- A bare USING with no WITH CHECK gates which rows may be *read for update* and
-- says nothing about what they may become. A moderator can therefore set their
-- own role to 'owner'.
--
-- ── 3. …and can move a membership row into a club they do not administer ───
--
-- Same missing WITH CHECK. USING is evaluated against the OLD row, so an admin
-- of club A could UPDATE their row setting club_id = B. Nothing evaluated B.
-- Requiring is_club_admin on the NEW row too is what closes it.
--
-- ── 4. A moderator can seize the club outright ─────────────────────────────
--
-- `clubs_update_admin` is also USING-only, and `clubs_delete_owner` is
-- `USING (auth.uid() = created_by)`. So a moderator could UPDATE the club
-- setting created_by = themselves, and then delete it. created_by is identity,
-- not a setting; it is now immutable.
--
-- ── 5. join_policy = 'request' meant nothing ───────────────────────────────
--
-- Self-inserting with status='active' skipped approval entirely, so the column
-- 049 added to distinguish an open club from one you ask to join has never had
-- an effect. The insert policy now derives status from it rather than trusting
-- the client.
--
-- ── Why creation still works ───────────────────────────────────────────────
--
-- Locking inserts to role='member' would leave a brand-new club with no owner,
-- because /api/clubs creates the club and then inserts its own owner row. That
-- insert moves into an AFTER INSERT trigger, which is SECURITY DEFINER and so
-- is not subject to the policy — the one place an 'owner' row can be created is
-- the moment the club itself is. Ownership transfer stays available to an
-- existing owner through the UPDATE policy below.
--
-- Idempotent: create or replace, drop policy/trigger if exists.

BEGIN;

-- ── Helper: owner specifically, not merely admin ────────────────────────────
-- Left on the default PUBLIC grant like its is_club_admin sibling: policies call
-- it, and a policy expression runs with the querying role's privileges.
CREATE OR REPLACE FUNCTION public.is_club_owner(p_club bigint, p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = p_club AND user_id = p_user
      AND status = 'active' AND role = 'owner'
  );
$$;

-- ── The creator becomes the owner, in the same transaction ─────────────────
CREATE OR REPLACE FUNCTION public.club_owner_on_create()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.club_members (club_id, user_id, role, status)
  VALUES (NEW.id, NEW.created_by, 'owner', 'active')
  ON CONFLICT (club_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_club_owner_on_create ON public.clubs;
CREATE TRIGGER trg_club_owner_on_create
AFTER INSERT ON public.clubs
FOR EACH ROW EXECUTE FUNCTION public.club_owner_on_create();

-- ── created_by is identity, not a setting ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.clubs_created_by_immutable()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'created_by cannot be changed' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clubs_created_by_immutable ON public.clubs;
CREATE TRIGGER trg_clubs_created_by_immutable
BEFORE UPDATE ON public.clubs
FOR EACH ROW EXECUTE FUNCTION public.clubs_created_by_immutable();

-- ── Joining: you may add yourself, as a member, at the status the club says ─
DROP POLICY IF EXISTS club_members_insert_self ON public.club_members;
CREATE POLICY club_members_insert_self ON public.club_members
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND role = 'member'
    AND status = CASE
      WHEN (SELECT c.join_policy FROM public.clubs c WHERE c.id = club_id) = 'open'
        THEN 'active'
      ELSE 'pending'
    END
  );

-- ── Admin edits: same club, and only an owner may hand out ownership ───────
DROP POLICY IF EXISTS club_members_update_admin ON public.club_members;
CREATE POLICY club_members_update_admin ON public.club_members
  FOR UPDATE
  USING (public.is_club_admin(club_id, auth.uid()))
  WITH CHECK (
    public.is_club_admin(club_id, auth.uid())
    AND (role <> 'owner' OR public.is_club_owner(club_id, auth.uid()))
  );

DROP POLICY IF EXISTS clubs_update_admin ON public.clubs;
CREATE POLICY clubs_update_admin ON public.clubs
  FOR UPDATE
  USING (public.is_club_admin(id, auth.uid()))
  WITH CHECK (public.is_club_admin(id, auth.uid()));

DROP POLICY IF EXISTS club_picks_update_admin ON public.club_picks;
CREATE POLICY club_picks_update_admin ON public.club_picks
  FOR UPDATE
  USING (club_id IS NOT NULL AND public.is_club_admin(club_id, auth.uid()))
  WITH CHECK (club_id IS NOT NULL AND public.is_club_admin(club_id, auth.uid()));

COMMIT;
