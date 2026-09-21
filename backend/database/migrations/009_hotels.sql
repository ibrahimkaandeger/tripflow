-- Adds hotels, hotel_rooms and hotel_room_participants. Purely
-- additive: no existing table is touched, and there is no backfill
-- since the prototype never had a hotel concept.
--
-- Model: tours -> hotels -> hotel_rooms -> hotel_room_participants ->
-- participants.
--
-- Status enums were not specified for any of the three tables, so
-- sensible defaults were picked (documented per table below).
-- Adjustable later without a structural change.

CREATE TABLE IF NOT EXISTS hotels (
  id SERIAL PRIMARY KEY,
  tour_id INTEGER NOT NULL,
  hotel_name VARCHAR(200) NOT NULL,
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100),
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  booking_reference VARCHAR(50),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_hotels_tour FOREIGN KEY (tour_id) REFERENCES tours(id) ON DELETE CASCADE,
  CONSTRAINT hotels_status_check CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED')),
  -- "check-out check-in'den once olamaz" -- equal dates (day-use
  -- style booking) are allowed, only check_out < check_in is not.
  CONSTRAINT hotels_dates_check CHECK (check_out >= check_in)
);

CREATE INDEX IF NOT EXISTS idx_hotels_tour_id ON hotels (tour_id);

CREATE TABLE IF NOT EXISTS hotel_rooms (
  id SERIAL PRIMARY KEY,
  hotel_id INTEGER NOT NULL,
  room_number VARCHAR(20) NOT NULL,
  room_type VARCHAR(50),
  capacity INTEGER,
  -- A room allocation within this booking is either active or
  -- cancelled; there's no separate "occupied" state because
  -- occupancy is derived from hotel_room_participants, not tracked
  -- redundantly here.
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_hotel_rooms_hotel FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE,
  CONSTRAINT hotel_rooms_hotel_room_number_key UNIQUE (hotel_id, room_number),
  CONSTRAINT hotel_rooms_status_check CHECK (status IN ('ACTIVE', 'CANCELLED')),
  CONSTRAINT hotel_rooms_capacity_check CHECK (capacity IS NULL OR capacity > 0)
);

CREATE INDEX IF NOT EXISTS idx_hotel_rooms_hotel_id ON hotel_rooms (hotel_id);

CREATE TABLE IF NOT EXISTS hotel_room_participants (
  id SERIAL PRIMARY KEY,
  room_id INTEGER NOT NULL,
  participant_id INTEGER NOT NULL,
  check_in DATE,
  check_out DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED',
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_hotel_room_participants_room FOREIGN KEY (room_id) REFERENCES hotel_rooms(id) ON DELETE CASCADE,
  CONSTRAINT fk_hotel_room_participants_participant FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE,
  -- The explicit duplicate-prevention rule: same participant can't be
  -- added to the same room twice.
  CONSTRAINT hotel_room_participants_room_participant_key UNIQUE (room_id, participant_id),
  CONSTRAINT hotel_room_participants_status_check CHECK (status IN ('CONFIRMED', 'CANCELLED')),
  CONSTRAINT hotel_room_participants_dates_check CHECK (check_out IS NULL OR check_in IS NULL OR check_out >= check_in)
);

CREATE INDEX IF NOT EXISTS idx_hotel_room_participants_room_id ON hotel_room_participants (room_id);
CREATE INDEX IF NOT EXISTS idx_hotel_room_participants_participant_id ON hotel_room_participants (participant_id);

-- Capacity guard: a CHECK constraint can't see other rows, so
-- enforcing "active occupants of a room <= its capacity" needs a
-- trigger. NULL capacity means unlimited/unspecified -> no check.
-- Cancelled assignments (status = 'CANCELLED') don't count against
-- capacity, on either side of the comparison.
CREATE OR REPLACE FUNCTION check_hotel_room_capacity()
RETURNS TRIGGER AS $$
DECLARE
  room_capacity INTEGER;
  current_count INTEGER;
BEGIN
  IF NEW.status = 'CANCELLED' THEN
    RETURN NEW;
  END IF;

  SELECT capacity INTO room_capacity FROM hotel_rooms WHERE id = NEW.room_id;

  IF room_capacity IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO current_count
  FROM hotel_room_participants
  WHERE room_id = NEW.room_id
    AND status <> 'CANCELLED'
    AND id <> COALESCE(NEW.id, -1);

  IF current_count + 1 > room_capacity THEN
    RAISE EXCEPTION 'hotel_room_participants: room % capacity % exceeded (already % active)', NEW.room_id, room_capacity, current_count;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hotel_room_capacity ON hotel_room_participants;
CREATE TRIGGER trg_hotel_room_capacity
  BEFORE INSERT OR UPDATE ON hotel_room_participants
  FOR EACH ROW
  EXECUTE FUNCTION check_hotel_room_capacity();

-- Tour-scoping guard, same approach as Phase 8's
-- check_flight_participant_in_tour: a participant may only be linked
-- to a room whose hotel belongs to a tour they are already
-- registered on via tour_participants. Since tour_participants can
-- never cross a tenant boundary (Phase 6's trigger), this
-- transitively enforces tenant isolation too.
CREATE OR REPLACE FUNCTION check_hotel_room_participant_in_tour()
RETURNS TRIGGER AS $$
DECLARE
  room_tour_id INTEGER;
  is_registered BOOLEAN;
BEGIN
  SELECT h.tour_id INTO room_tour_id
  FROM hotel_rooms hr
  JOIN hotels h ON h.id = hr.hotel_id
  WHERE hr.id = NEW.room_id;

  IF room_tour_id IS NULL THEN
    RAISE EXCEPTION 'hotel_room_participants: referenced room/hotel does not exist';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM tour_participants tp
    WHERE tp.tour_id = room_tour_id AND tp.participant_id = NEW.participant_id
  ) INTO is_registered;

  IF NOT is_registered THEN
    RAISE EXCEPTION 'hotel_room_participants: participant % is not registered on tour % (room %)', NEW.participant_id, room_tour_id, NEW.room_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hotel_room_participants_in_tour ON hotel_room_participants;
CREATE TRIGGER trg_hotel_room_participants_in_tour
  BEFORE INSERT OR UPDATE ON hotel_room_participants
  FOR EACH ROW
  EXECUTE FUNCTION check_hotel_room_participant_in_tour();

-- Rollback recipe (manual, not executed here -- no other table is
-- ever touched by it):
--   DROP TRIGGER IF EXISTS trg_hotel_room_participants_in_tour ON hotel_room_participants;
--   DROP FUNCTION IF EXISTS check_hotel_room_participant_in_tour();
--   DROP TRIGGER IF EXISTS trg_hotel_room_capacity ON hotel_room_participants;
--   DROP FUNCTION IF EXISTS check_hotel_room_capacity();
--   DROP TABLE IF EXISTS hotel_room_participants;
--   DROP TABLE IF EXISTS hotel_rooms;
--   DROP TABLE IF EXISTS hotels;
