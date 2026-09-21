-- Adds announcements and announcement_reads. Purely additive: no
-- existing table is touched, and there is no backfill since the
-- prototype never had an announcements concept.
--
-- Model: tours -> announcements -> announcement_reads. Scope is
-- deliberately tour-only this round (not "company OR tour" as the
-- original broader spec allowed) -- "an announcement belongs only to
-- its own tour" is an explicit rule here. tour_id is therefore
-- NOT NULL and there's no separate company_id column: tenant
-- isolation comes transitively through tour_id -> tours.company_id,
-- the same single-parent shape as tour_days/hotels. Extending to
-- company-wide announcements later would just mean making tour_id
-- nullable and adding company_id, without breaking anything here.
--
-- announcement_reads deliberately supports two different readers
-- without ever requiring a user account:
--   - participant_id: a tour participant read it (participant may or
--     may not have a linked user account -- the durable identity
--     being tracked is the participant record itself).
--   - user_id: a company staff member read it in their own capacity.
-- Exactly one of the two must be set (CHECK, enforced below), never
-- both, never neither. This is what keeps the participant/user
-- distinction intact instead of forcing every reader through users.

CREATE TABLE IF NOT EXISTS announcements (
  id SERIAL PRIMARY KEY,
  tour_id INTEGER NOT NULL,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  published_at TIMESTAMP,
  expires_at TIMESTAMP,
  created_by INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_announcements_tour FOREIGN KEY (tour_id) REFERENCES tours(id) ON DELETE CASCADE,
  -- Durable record: deleting the staff member who wrote it must not
  -- silently delete the announcement, matching tours.created_by.
  CONSTRAINT fk_announcements_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT announcements_priority_check CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
  CONSTRAINT announcements_status_check CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  -- A PUBLISHED announcement must actually have a publish timestamp.
  CONSTRAINT announcements_published_check CHECK (status <> 'PUBLISHED' OR published_at IS NOT NULL),
  -- If both are set, expiry must come after publishing.
  CONSTRAINT announcements_dates_check CHECK (expires_at IS NULL OR published_at IS NULL OR expires_at > published_at)
);

CREATE INDEX IF NOT EXISTS idx_announcements_tour_id ON announcements (tour_id);
CREATE INDEX IF NOT EXISTS idx_announcements_status ON announcements (status);
CREATE INDEX IF NOT EXISTS idx_announcements_created_by ON announcements (created_by);

CREATE TABLE IF NOT EXISTS announcement_reads (
  id SERIAL PRIMARY KEY,
  announcement_id INTEGER NOT NULL,
  user_id INTEGER,
  participant_id INTEGER,
  read_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_announcement_reads_announcement FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE,
  -- A read receipt is personal activity data, not a business record
  -- like the announcement itself -- fine to cascade away if the
  -- account/participant is removed.
  CONSTRAINT fk_announcement_reads_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_announcement_reads_participant FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE,
  -- Exactly one reader identity per row: never both, never neither.
  CONSTRAINT announcement_reads_reader_check CHECK (
    (user_id IS NOT NULL AND participant_id IS NULL) OR
    (user_id IS NULL AND participant_id IS NOT NULL)
  )
);

-- Two partial unique indexes instead of one composite UNIQUE: a
-- composite UNIQUE(announcement_id, user_id, participant_id) would
-- not stop duplicates within either group, since SQL never treats
-- NULL = NULL for uniqueness (same issue solved for roles in
-- Phase 3). Each index only ever applies to the rows where the
-- reader column it covers is actually set.
CREATE UNIQUE INDEX IF NOT EXISTS announcement_reads_user_key
  ON announcement_reads (announcement_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS announcement_reads_participant_key
  ON announcement_reads (announcement_id, participant_id) WHERE participant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_announcement_reads_announcement_id ON announcement_reads (announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_reads_user_id ON announcement_reads (user_id);
CREATE INDEX IF NOT EXISTS idx_announcement_reads_participant_id ON announcement_reads (participant_id);

-- Tour/tenant-scoping guard, same approach as Phase 8/9's triggers:
--   - a participant read is only valid if that participant is
--     registered on the announcement's tour (tour_participants);
--   - a user read is only valid if that user is a member of the
--     announcement's tour's company (company_users).
-- Both paths route through tables that can never cross a tenant
-- boundary themselves, so this transitively enforces tenant
-- isolation for reads too.
CREATE OR REPLACE FUNCTION check_announcement_read_scope()
RETURNS TRIGGER AS $$
DECLARE
  ann_tour_id INTEGER;
  ann_company_id INTEGER;
  is_valid BOOLEAN;
BEGIN
  SELECT a.tour_id, t.company_id INTO ann_tour_id, ann_company_id
  FROM announcements a
  JOIN tours t ON t.id = a.tour_id
  WHERE a.id = NEW.announcement_id;

  IF ann_tour_id IS NULL THEN
    RAISE EXCEPTION 'announcement_reads: referenced announcement does not exist';
  END IF;

  IF NEW.participant_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM tour_participants tp
      WHERE tp.tour_id = ann_tour_id AND tp.participant_id = NEW.participant_id
    ) INTO is_valid;

    IF NOT is_valid THEN
      RAISE EXCEPTION 'announcement_reads: participant % is not registered on tour % (announcement %)', NEW.participant_id, ann_tour_id, NEW.announcement_id;
    END IF;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM company_users cu
      WHERE cu.company_id = ann_company_id AND cu.user_id = NEW.user_id
    ) INTO is_valid;

    IF NOT is_valid THEN
      RAISE EXCEPTION 'announcement_reads: user % is not a member of company % (announcement %)', NEW.user_id, ann_company_id, NEW.announcement_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_announcement_read_scope ON announcement_reads;
CREATE TRIGGER trg_announcement_read_scope
  BEFORE INSERT OR UPDATE ON announcement_reads
  FOR EACH ROW
  EXECUTE FUNCTION check_announcement_read_scope();

-- Structure supports future participant-dashboard unread queries
-- directly, no extra table needed, e.g.:
--   SELECT a.*
--   FROM announcements a
--   WHERE a.tour_id = $1 AND a.status = 'PUBLISHED'
--     AND NOT EXISTS (
--       SELECT 1 FROM announcement_reads ar
--       WHERE ar.announcement_id = a.id AND ar.participant_id = $2
--     );

-- Rollback recipe (manual, not executed here -- no other table is
-- ever touched by it):
--   DROP TRIGGER IF EXISTS trg_announcement_read_scope ON announcement_reads;
--   DROP FUNCTION IF EXISTS check_announcement_read_scope();
--   DROP TABLE IF EXISTS announcement_reads;
--   DROP TABLE IF EXISTS announcements;
