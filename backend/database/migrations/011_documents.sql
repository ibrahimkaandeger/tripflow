-- Adds `documents` (B2B+B2C document metadata). Purely additive: no
-- existing table is touched, and there is no backfill since the
-- prototype never had a documents concept.
--
-- Model: tours -> documents, with an optional pointer to a specific
-- participant. No separate company_id column: the tenant chain is
-- documents -> tours -> companies (general documents) and
-- documents -> participants -> companies (participant documents),
-- both already established in earlier phases.
--
-- Storage is out of scope here: only file_name/file_url/mime_type/
-- file_size metadata is stored, so this can point at S3/Supabase/any
-- other storage later without a schema change. file_url is a plain
-- TEXT column with no format CHECK -- URL validation belongs in the
-- application layer, not the database.
--
-- Deletion behavior:
--   - tour_id -> tours: ON DELETE CASCADE (explicit).
--   - uploaded_by -> users: ON DELETE RESTRICT (explicit) -- keeps
--     the audit trail meaningful; a staff account can't be deleted
--     out from under documents they uploaded.
--   - participant_id -> participants: ON DELETE CASCADE. This
--     matches every other participant_id FK added so far
--     (tour_participants, flight_participants, hotel_room_participants,
--     announcement_reads all cascade on participant delete). CASCADE
--     is what actually satisfies "no orphan documents": the row is
--     gone, not left dangling. SET NULL was rejected on purpose --
--     it would silently turn a personal document (passport copy,
--     ticket) into what the schema treats as a general tour-level
--     document (participant_id IS NULL), which is a real information-
--     exposure risk, not just a data-modeling inconvenience. Hard
--     deletes of participants are expected to be rare in practice
--     (participants are soft-deleted via status), so this only fires
--     in the genuine cleanup case.
--
-- Category has no default on purpose: every document should be
-- deliberately classified (PASSPORT vs OTHER matters for who should
-- see it), so the insert must say so explicitly rather than silently
-- falling through to a default.
--
-- Visibility defaults to COMPANY_ONLY -- the most restrictive option
-- -- so a newly uploaded document is staff-only until someone
-- explicitly marks it shareable with the participant. Actual
-- enforcement of what COMPANY_ONLY/PARTICIPANT/BOTH means happens in
-- a future API authorization layer; this migration only stores the
-- value.

CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  tour_id INTEGER NOT NULL,
  participant_id INTEGER,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(20) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  mime_type VARCHAR(100),
  file_size BIGINT,
  visibility VARCHAR(20) NOT NULL DEFAULT 'COMPANY_ONLY',
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  uploaded_by INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_documents_tour FOREIGN KEY (tour_id) REFERENCES tours(id) ON DELETE CASCADE,
  CONSTRAINT fk_documents_participant FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE,
  CONSTRAINT fk_documents_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT documents_category_check CHECK (category IN ('PASSPORT', 'TICKET', 'VISA', 'PROGRAM', 'CONTRACT', 'INSURANCE', 'OTHER')),
  CONSTRAINT documents_visibility_check CHECK (visibility IN ('COMPANY_ONLY', 'PARTICIPANT', 'BOTH')),
  CONSTRAINT documents_status_check CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  CONSTRAINT documents_file_size_check CHECK (file_size IS NULL OR file_size > 0)
);

CREATE INDEX IF NOT EXISTS idx_documents_tour_id ON documents (tour_id);
CREATE INDEX IF NOT EXISTS idx_documents_participant_id ON documents (participant_id);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents (category);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents (status);
-- Compound index for the common "documents for this tour, optionally
-- filtered to one participant" query shape.
CREATE INDEX IF NOT EXISTS idx_documents_tour_participant ON documents (tour_id, participant_id);

-- Tour-scoping guard, same approach as Phase 8/9/10's triggers: if a
-- document is attached to a specific participant, that participant
-- must already be registered on documents.tour_id via
-- tour_participants. This simultaneously rejects:
--   - Company B's participant on Company A's tour (cross-tenant), and
--   - Company A's own participant who is registered on a DIFFERENT
--     Company A tour, not this one.
-- A NULL participant_id (general tour-level document) skips the
-- check entirely -- there's nothing to scope.
CREATE OR REPLACE FUNCTION check_document_participant_in_tour()
RETURNS TRIGGER AS $$
DECLARE
  is_registered BOOLEAN;
BEGIN
  IF NEW.participant_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM tour_participants tp
    WHERE tp.tour_id = NEW.tour_id AND tp.participant_id = NEW.participant_id
  ) INTO is_registered;

  IF NOT is_registered THEN
    RAISE EXCEPTION 'documents: participant % is not registered on tour %', NEW.participant_id, NEW.tour_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_document_participant_in_tour ON documents;
CREATE TRIGGER trg_document_participant_in_tour
  BEFORE INSERT OR UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION check_document_participant_in_tour();

-- Rollback recipe (manual, not executed here -- no other table is
-- ever touched by it):
--   DROP TRIGGER IF EXISTS trg_document_participant_in_tour ON documents;
--   DROP FUNCTION IF EXISTS check_document_participant_in_tour();
--   DROP TABLE IF EXISTS documents;
