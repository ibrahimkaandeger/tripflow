-- Adds `participants` and `tour_participants`. Purely additive: no
-- existing table is touched, and there is no data to backfill here
-- (the prototype never had a participant concept).
--
-- Core rule: a participant is NOT a user. user_id is nullable on
-- purpose -- creating a participant must never require creating a
-- user account, and a participant can be linked to one later without
-- having existed as a user first.
--
-- Tenant isolation:
--   - participants.company_id is NOT NULL: every participant belongs
--     to exactly one company from creation, same as tours.
--   - tour_participants has no company_id of its own (it's a pure
--     join), so the real risk is linking a tour from Company A to a
--     participant from Company B -- a cross-tenant leak that no FK
--     alone can prevent. A trigger enforces it at the database level
--     as a last line of defense, on top of whatever the application
--     layer checks later.

CREATE TABLE IF NOT EXISTS participants (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL,
  user_id INTEGER,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  passport_number VARCHAR(50),
  passport_country VARCHAR(100),
  city VARCHAR(100),
  birth_date DATE,
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_participants_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_participants_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  -- Same user account can't be linked twice within one company, but
  -- CAN be a participant in several different companies. Rows with
  -- user_id IS NULL are never compared against each other by this
  -- constraint (standard SQL NULL semantics), which is exactly what
  -- we want: many unlinked participants per company is normal.
  CONSTRAINT participants_company_user_key UNIQUE (company_id, user_id),
  CONSTRAINT participants_status_check CHECK (status IN ('ACTIVE', 'INACTIVE', 'CANCELLED')),
  -- A participant must be reachable by at least one contact method.
  CONSTRAINT participants_contact_check CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_participants_company_id ON participants (company_id);
CREATE INDEX IF NOT EXISTS idx_participants_email ON participants (email);
CREATE INDEX IF NOT EXISTS idx_participants_user_id ON participants (user_id);

CREATE TABLE IF NOT EXISTS tour_participants (
  id SERIAL PRIMARY KEY,
  tour_id INTEGER NOT NULL,
  participant_id INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'REGISTERED',
  room_number VARCHAR(20),
  special_requirements TEXT,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tour_participants_tour FOREIGN KEY (tour_id) REFERENCES tours(id) ON DELETE CASCADE,
  CONSTRAINT fk_tour_participants_participant FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE,
  -- The explicit duplicate-prevention rule: same participant can't be
  -- added to the same tour twice.
  CONSTRAINT tour_participants_tour_participant_key UNIQUE (tour_id, participant_id),
  CONSTRAINT tour_participants_status_check CHECK (status IN ('REGISTERED', 'CONFIRMED', 'CANCELLED', 'COMPLETED'))
);

CREATE INDEX IF NOT EXISTS idx_tour_participants_tour_id ON tour_participants (tour_id);
CREATE INDEX IF NOT EXISTS idx_tour_participants_participant_id ON tour_participants (participant_id);

-- Cross-tenant guard: a tour_participants row may only link a tour
-- and a participant that belong to the same company. FKs alone can't
-- express this (it's a constraint across two different parent
-- tables), so it's enforced with a trigger. CREATE OR REPLACE /
-- DROP...IF EXISTS keep this block safe to re-run by hand.
CREATE OR REPLACE FUNCTION check_tour_participant_same_company()
RETURNS TRIGGER AS $$
DECLARE
  tour_company_id INTEGER;
  participant_company_id INTEGER;
BEGIN
  SELECT company_id INTO tour_company_id FROM tours WHERE id = NEW.tour_id;
  SELECT company_id INTO participant_company_id FROM participants WHERE id = NEW.participant_id;

  IF tour_company_id IS NULL OR participant_company_id IS NULL THEN
    RAISE EXCEPTION 'tour_participants: referenced tour or participant does not exist';
  END IF;

  IF tour_company_id <> participant_company_id THEN
    RAISE EXCEPTION 'tour_participants: tour (company %) and participant (company %) belong to different companies', tour_company_id, participant_company_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tour_participants_same_company ON tour_participants;
CREATE TRIGGER trg_tour_participants_same_company
  BEFORE INSERT OR UPDATE ON tour_participants
  FOR EACH ROW
  EXECUTE FUNCTION check_tour_participant_same_company();
