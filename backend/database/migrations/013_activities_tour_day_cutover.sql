-- The controlled cutover step Phase 7 explicitly deferred: "trip_day_id
-- remains NOT NULL... tour_day_id is an additive mirror the future
-- API layer can start reading once it's ready to switch over; that
-- cutover... is its own later, separate step." This is that step,
-- triggered by a real necessity: the Business API phase needs to
-- create activities for brand-new tours that have no corresponding
-- legacy trip_day at all, which trip_day_id NOT NULL made impossible.
--
-- This does NOT drop, rename, or repurpose any column -- it only
-- relaxes trip_day_id from NOT NULL to nullable, and adds a CHECK so
-- an activity can never end up with neither reference (still
-- anchored to at least one day, old or new model). Existing legacy
-- rows are untouched (trip_day_id already has a value on all of
-- them); the legacy POST /api/activities flow keeps supplying
-- trip_day_id exactly as before, so nothing about it changes.

ALTER TABLE activities ALTER COLUMN trip_day_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'activities_day_reference_check'
  ) THEN
    ALTER TABLE activities
      ADD CONSTRAINT activities_day_reference_check
      CHECK (trip_day_id IS NOT NULL OR tour_day_id IS NOT NULL);
  END IF;
END $$;

-- Rollback recipe (manual, not executed here):
--   ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_day_reference_check;
--   ALTER TABLE activities ALTER COLUMN trip_day_id SET NOT NULL;
--   (only safe if every row still has trip_day_id populated)
