-- Fixes a real bug introduced by 013's activities_day_reference_check:
-- fk_activities_tour_day is ON DELETE SET NULL (from Phase 7, when
-- trip_day_id was always the fallback owner). Now that trip_day_id
-- can be NULL too (013's cutover), deleting a tour_day whose activity
-- has ONLY tour_day_id (a business-API-created activity, no legacy
-- trip_day) would have Postgres try to null tour_day_id out as part
-- of the FK action -- leaving both columns NULL, which 013's own
-- CHECK constraint correctly refuses. Net effect without this fix:
-- deleting a tour (which cascades to its tour_days) fails outright
-- for any tour that has business-API-created activities. Found while
-- testing the Business API's tour deletion flow, not a hypothetical.
--
-- Fix: a BEFORE DELETE trigger on tour_days that handles the two
-- cases correctly before the row (and the FK's own SET NULL action)
-- ever fires:
--   - an activity that still has trip_day_id -> just null its
--     tour_day_id (same outcome Phase 7 always intended: it survives,
--     anchored to the legacy day).
--   - an activity with NO trip_day_id (business-API-only) -> delete
--     it outright, since a tour_day was its only anchor and it's
--     going away.
-- The existing FK's ON DELETE SET NULL is left in place as a
-- redundant safety net -- by the time it would run, this trigger has
-- already resolved every activities row pointing at the tour_day
-- being deleted, so it becomes a no-op.

CREATE OR REPLACE FUNCTION handle_tour_day_activities_before_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM activities WHERE tour_day_id = OLD.id AND trip_day_id IS NULL;
  UPDATE activities SET tour_day_id = NULL WHERE tour_day_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tour_day_activities_before_delete ON tour_days;
CREATE TRIGGER trg_tour_day_activities_before_delete
  BEFORE DELETE ON tour_days
  FOR EACH ROW
  EXECUTE FUNCTION handle_tour_day_activities_before_delete();

-- Rollback recipe (manual, not executed here):
--   DROP TRIGGER IF EXISTS trg_tour_day_activities_before_delete ON tour_days;
--   DROP FUNCTION IF EXISTS handle_tour_day_activities_before_delete();
