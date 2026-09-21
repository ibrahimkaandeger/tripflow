-- Connects the tours hierarchy down to the daily program, without
-- touching trip_days or activities' existing structure or data.
--
-- Analysis of current data before designing this (read-only, via
-- introspection): 2 trip_days rows (day 1 and day 2, both under
-- trip_id=1), 1 activities row (title/description/location/times
-- fully populated, trip_day_id=1). tours has exactly 1 row, with
-- legacy_trip_id=1 pointing back to that same trip (from Phase 5).
-- trip_days has no created_at/updated_at at all -- there's nothing
-- to preserve for those on the new rows, so they get the migration's
-- run time instead (documented, not fabricated as if historical).
--
-- Approach (two additive moves, mirroring the tours.legacy_trip_id
-- pattern from Phase 5 for the same reasons: idempotency + an
-- explicit, queryable trail of what came from where):
--
--   1. New table `tour_days`, backfilled one row per existing
--      trip_days row, tour_id resolved via tours.legacy_trip_id =
--      trip_days.trip_id. legacy_trip_day_id (nullable, UNIQUE, FK to
--      trip_days) is the traceability/idempotency column:
--        SELECT * FROM tour_days WHERE legacy_trip_day_id IS NOT NULL
--          -> shows exactly what was backfilled and from where.
--        DELETE FROM tour_days WHERE legacy_trip_day_id IS NOT NULL
--          -> undoes the backfill without touching trip_days.
--
--   2. A new nullable `activities.tour_day_id` column, ADDED to the
--      EXISTING activities table -- not a new activities row, not a
--      new table. The existing activity keeps its id and every
--      current column untouched; it just gains a second, parallel
--      pointer into the new structure, backfilled by joining through
--      tour_days.legacy_trip_day_id = activities.trip_day_id.
--
-- Transition-period consistency: trip_day_id remains NOT NULL and is
-- still the authoritative FK -- nothing about the existing read/write
-- path changes. tour_day_id is an additive mirror the future API
-- layer can start reading once it's ready to switch over; that
-- cutover (and eventually dropping trip_day_id once nothing reads it)
-- is its own later, separate step, not part of this migration.
--
-- Tenant isolation: tour_days has no company_id of its own by design
-- -- it belongs to a company only via tour_id -> tours.company_id,
-- the same one-parent shape trip_days already has via trip_id ->
-- trips.user_id today. There are no two independent company-bearing
-- foreign keys here (unlike tour_participants), so there's no
-- cross-tenant mismatch a trigger would need to catch: tour_id is the
-- single source of truth for which company a tour_day (and,
-- transitively, its activities) belongs to.
--
-- Rollback recipe (manual, not executed here -- trip_days/activities
-- are never touched by it):
--   ALTER TABLE activities DROP CONSTRAINT IF EXISTS fk_activities_tour_day;
--   ALTER TABLE activities DROP COLUMN IF EXISTS tour_day_id;
--   DROP TABLE IF EXISTS tour_days;

CREATE TABLE IF NOT EXISTS tour_days (
  id SERIAL PRIMARY KEY,
  tour_id INTEGER NOT NULL,
  day_number INTEGER NOT NULL,
  date DATE NOT NULL,
  title VARCHAR(150),
  description TEXT,
  legacy_trip_day_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tour_days_tour FOREIGN KEY (tour_id) REFERENCES tours(id) ON DELETE CASCADE,
  CONSTRAINT fk_tour_days_legacy_trip_day FOREIGN KEY (legacy_trip_day_id) REFERENCES trip_days(id) ON DELETE SET NULL,
  CONSTRAINT tour_days_legacy_trip_day_key UNIQUE (legacy_trip_day_id),
  CONSTRAINT tour_days_tour_day_number_key UNIQUE (tour_id, day_number),
  CONSTRAINT tour_days_day_number_check CHECK (day_number > 0)
);

CREATE INDEX IF NOT EXISTS idx_tour_days_tour_id ON tour_days (tour_id);

-- Backfill: one tour_day per existing trip_days row.
INSERT INTO tour_days (tour_id, day_number, date, legacy_trip_day_id, created_at, updated_at)
SELECT
  tr.id,
  td.day_number,
  td.date,
  td.id,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM trip_days td
JOIN tours tr ON tr.legacy_trip_id = td.trip_id
ON CONFLICT (legacy_trip_day_id) DO NOTHING;

-- Add the new parallel pointer to the existing activities table.
-- Nullable: activities not yet backfilled (or created before tours
-- existed) are unaffected.
ALTER TABLE activities ADD COLUMN IF NOT EXISTS tour_day_id INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_activities_tour_day'
  ) THEN
    ALTER TABLE activities
      ADD CONSTRAINT fk_activities_tour_day
      FOREIGN KEY (tour_day_id) REFERENCES tour_days(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_activities_tour_day_id ON activities (tour_day_id);

-- Backfill the pointer on existing activities, via the trip_day they
-- already point to.
UPDATE activities a
SET tour_day_id = td.id
FROM tour_days td
WHERE td.legacy_trip_day_id = a.trip_day_id
  AND a.tour_day_id IS NULL;
