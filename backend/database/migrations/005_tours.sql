-- Adds `tours`, the new primary business entity, and backfills one
-- tour per existing row in `trips`. Purely additive: trips, trip_days
-- and activities are not touched, renamed, or altered in any way —
-- they keep working exactly as they do today. Connecting trip_days /
-- activities to tours is deliberately left for a later, separate
-- migration (see note at the bottom of this file).
--
-- Tenant isolation: company_id is NOT NULL and FK'd to companies, so
-- every tour has exactly one owning tenant from creation. Indexed for
-- the company-scoped queries every tour endpoint will run.
--
-- legacy_trip_id is NOT part of the spec's tours field list. It is a
-- deliberate addition: a nullable, UNIQUE, FK-backed pointer to the
-- original trips row a backfilled tour came from. It exists purely to
-- make this migration idempotent (ON CONFLICT (legacy_trip_id) DO
-- NOTHING -- no duplicate tour on a second run) and to make the
-- backfill auditable/reversible:
--   - "which tours came from the old prototype data?"
--     SELECT * FROM tours WHERE legacy_trip_id IS NOT NULL;
--   - "undo the backfill without touching trips at all"
--     DELETE FROM tours WHERE legacy_trip_id IS NOT NULL;
-- Real tours created through the API going forward will simply have
-- legacy_trip_id = NULL. ON DELETE SET NULL: if `trips` is ever
-- dropped in a future phase, tours rows survive, just losing the
-- backward pointer.
--
-- created_by uses ON DELETE RESTRICT (not CASCADE like trips.user_id)
-- because a tour is meant to be a durable business record: deleting
-- the staff member who created it must not silently delete the tour.
-- The delete has to be blocked until the tour is reassigned or
-- archived.

CREATE TABLE IF NOT EXISTS tours (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL,
  title VARCHAR(150) NOT NULL,
  description TEXT,
  destination VARCHAR(150) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  capacity INTEGER,
  created_by INTEGER NOT NULL,
  legacy_trip_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tours_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_tours_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_tours_legacy_trip FOREIGN KEY (legacy_trip_id) REFERENCES trips(id) ON DELETE SET NULL,
  CONSTRAINT tours_legacy_trip_key UNIQUE (legacy_trip_id),
  CONSTRAINT tours_status_check CHECK (status IN ('DRAFT', 'PLANNED', 'CONFIRMED', 'ONGOING', 'COMPLETED', 'CANCELLED')),
  CONSTRAINT tours_capacity_check CHECK (capacity IS NULL OR capacity > 0),
  CONSTRAINT tours_dates_check CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_tours_company_id ON tours (company_id);
CREATE INDEX IF NOT EXISTS idx_tours_start_date ON tours (start_date);
CREATE INDEX IF NOT EXISTS idx_tours_status ON tours (status);
CREATE INDEX IF NOT EXISTS idx_tours_created_by ON tours (created_by);

-- Backfill: one tour per existing trip, owned by the company the
-- trip's user is already a member of (from the Phase 4 backfill).
-- If a trip owner somehow has more than one company_users membership,
-- prefer the one where they hold the global OWNER role, then the
-- oldest membership -- this is the strongest available "correct
-- company" signal for that user's legacy data. In today's data every
-- trip owner has exactly one membership (Legacy / Migrated Data,
-- OWNER), so this resolves unambiguously.
--
-- Status is set to 'PLANNED' for every backfilled tour -- a neutral,
-- conservative default (these already have real dates and were in
-- active use, so 'DRAFT' would understate them; we don't guess
-- ONGOING/COMPLETED from today's date since that's a business
-- judgment, not a migration's call). Adjustable per-tour afterwards
-- through the normal update endpoint once it exists.
INSERT INTO tours (
  company_id, title, description, destination, start_date, end_date,
  status, capacity, created_by, legacy_trip_id, created_at, updated_at
)
SELECT
  owner_company.company_id,
  t.title,
  NULL,
  t.destination,
  t.start_date,
  t.end_date,
  'PLANNED',
  NULL,
  t.user_id,
  t.id,
  t.created_at,
  t.created_at
FROM trips t
JOIN LATERAL (
  SELECT cu.company_id
  FROM company_users cu
  WHERE cu.user_id = t.user_id
  ORDER BY
    CASE WHEN cu.role_id = (SELECT id FROM roles WHERE company_id IS NULL AND name = 'OWNER') THEN 0 ELSE 1 END,
    cu.created_at
  LIMIT 1
) owner_company ON TRUE
ON CONFLICT (legacy_trip_id) DO NOTHING;

-- NOT done in this migration, by design (per explicit instruction):
-- trip_days and activities still point at trips/trip_days exactly as
-- before. Wiring them to tours is planned as its own controlled
-- migration:
--   1. Add a nullable tour_days.tour_id (new table) or a nullable
--      tours-pointing column, backfilled via tours.legacy_trip_id ->
--      trips.id -> trip_days.trip_id, while trip_days/activities keep
--      working unchanged for existing consumers.
--   2. Only after the API layer is repointed to read/write through
--      tours/tour_days would trip_id ever be considered for removal
--      -- and even then, only by dropping it once nothing references
--      it, never by dropping the trip_days/activities tables
--      themselves.
