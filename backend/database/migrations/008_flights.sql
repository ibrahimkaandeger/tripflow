-- Adds flights and flight_participants. Purely additive: no existing
-- table (trips/trip_days/activities/tours/tour_days/participants/
-- tour_participants) is touched, and there is no backfill since the
-- prototype never had a flights concept.
--
-- Model: tours -> flights -> flight_participants -> participants.
-- flight_participants carries no company_id of its own; its tenant/
-- tour correctness is enforced by requiring the participant to
-- already be registered on the flight's tour via tour_participants
-- (see trigger below), which itself can never cross a tenant
-- boundary (enforced in Phase 6).
--
-- Field choices beyond the requested list:
--   - booking_reference: not in the minimum list given, added because
--     it's a standard part of a real flight record (was in the
--     original spec's flights section) and doesn't conflict with
--     anything.
--   - status enums weren't specified, so sensible defaults were
--     picked: flights get SCHEDULED/DELAYED/CANCELLED/COMPLETED,
--     flight_participants get CONFIRMED/CANCELLED. Adjustable later.

CREATE TABLE IF NOT EXISTS flights (
  id SERIAL PRIMARY KEY,
  tour_id INTEGER NOT NULL,
  airline VARCHAR(150) NOT NULL,
  flight_number VARCHAR(20) NOT NULL,
  departure_airport VARCHAR(100) NOT NULL,
  arrival_airport VARCHAR(100) NOT NULL,
  departure_datetime TIMESTAMP NOT NULL,
  arrival_datetime TIMESTAMP NOT NULL,
  departure_terminal VARCHAR(20),
  arrival_terminal VARCHAR(20),
  booking_reference VARCHAR(50),
  status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_flights_tour FOREIGN KEY (tour_id) REFERENCES tours(id) ON DELETE CASCADE,
  CONSTRAINT flights_status_check CHECK (status IN ('SCHEDULED', 'DELAYED', 'CANCELLED', 'COMPLETED')),
  -- A flight must land strictly after it departs.
  CONSTRAINT flights_datetime_check CHECK (arrival_datetime > departure_datetime)
);

CREATE INDEX IF NOT EXISTS idx_flights_tour_id ON flights (tour_id);
CREATE INDEX IF NOT EXISTS idx_flights_departure_datetime ON flights (departure_datetime);

CREATE TABLE IF NOT EXISTS flight_participants (
  id SERIAL PRIMARY KEY,
  flight_id INTEGER NOT NULL,
  participant_id INTEGER NOT NULL,
  seat_number VARCHAR(10),
  ticket_number VARCHAR(50),
  status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED',
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_flight_participants_flight FOREIGN KEY (flight_id) REFERENCES flights(id) ON DELETE CASCADE,
  CONSTRAINT fk_flight_participants_participant FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE,
  -- The explicit duplicate-prevention rule: same participant can't be
  -- added to the same flight twice.
  CONSTRAINT flight_participants_flight_participant_key UNIQUE (flight_id, participant_id),
  CONSTRAINT flight_participants_status_check CHECK (status IN ('CONFIRMED', 'CANCELLED'))
);

CREATE INDEX IF NOT EXISTS idx_flight_participants_flight_id ON flight_participants (flight_id);
CREATE INDEX IF NOT EXISTS idx_flight_participants_participant_id ON flight_participants (participant_id);

-- Tour-scoping guard: "a flight may only be linked to participants
-- belonging to its own tour" -- stronger than a same-company check.
-- A participant must already be registered on the flight's tour via
-- tour_participants. Since tour_participants itself can never cross
-- a tenant boundary (Phase 6's trigger), this transitively enforces
-- tenant isolation too.
CREATE OR REPLACE FUNCTION check_flight_participant_in_tour()
RETURNS TRIGGER AS $$
DECLARE
  flight_tour_id INTEGER;
  is_registered BOOLEAN;
BEGIN
  SELECT tour_id INTO flight_tour_id FROM flights WHERE id = NEW.flight_id;

  IF flight_tour_id IS NULL THEN
    RAISE EXCEPTION 'flight_participants: referenced flight does not exist';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM tour_participants tp
    WHERE tp.tour_id = flight_tour_id AND tp.participant_id = NEW.participant_id
  ) INTO is_registered;

  IF NOT is_registered THEN
    RAISE EXCEPTION 'flight_participants: participant % is not registered on tour % (flight %)', NEW.participant_id, flight_tour_id, NEW.flight_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_flight_participants_in_tour ON flight_participants;
CREATE TRIGGER trg_flight_participants_in_tour
  BEFORE INSERT OR UPDATE ON flight_participants
  FOR EACH ROW
  EXECUTE FUNCTION check_flight_participant_in_tour();

-- Rollback recipe (manual, not executed here -- no other table is
-- ever touched by it):
--   DROP TRIGGER IF EXISTS trg_flight_participants_in_tour ON flight_participants;
--   DROP FUNCTION IF EXISTS check_flight_participant_in_tour();
--   DROP TABLE IF EXISTS flight_participants;
--   DROP TABLE IF EXISTS flights;
