-- Adds company_users (the User <-> Company <-> Role join) and backfills
-- it from the existing prototype data. Purely additive: users and
-- trips are never modified, only read from.
--
-- Backfill policy (confirmed with the user before writing this):
--   - Create exactly one "Legacy / Migrated Data" company to hold
--     pre-existing prototype data that predates the company model.
--   - Only users who actually own at least one row in `trips` get a
--     company_users membership, with role OWNER on that company --
--     because they demonstrably have data to own.
--   - Users with no trips get NO membership at all. Fabricating a
--     membership for a user with no relationship to any tour data
--     would be a fake row with no basis, which was explicitly ruled
--     out. They remain company-less until they actually create or
--     join a company through the API.
--   - This is NOT "make every existing user OWNER" -- it is
--     "recognize the ownership relationship that already exists in
--     the data."
--
-- ON DELETE choices:
--   - company_id -> companies: CASCADE (memberships are meaningless
--     without the company; companies are soft-deleted via status in
--     practice, so this rarely fires).
--   - user_id -> users: CASCADE, matching the existing trips.user_id
--     behavior (deleting a user already cascades through their trips
--     today; membership rows should disappear the same way).
--   - role_id -> roles: RESTRICT, so a role that is actively assigned
--     to someone cannot be deleted out from under them. The assigner
--     must move the person to a different role first.

CREATE TABLE IF NOT EXISTS company_users (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role_id INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_company_users_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_company_users_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_company_users_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT,
  CONSTRAINT company_users_status_check CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
  CONSTRAINT company_users_company_user_key UNIQUE (company_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_company_users_company_id ON company_users (company_id);
CREATE INDEX IF NOT EXISTS idx_company_users_user_id ON company_users (user_id);
CREATE INDEX IF NOT EXISTS idx_company_users_role_id ON company_users (role_id);

-- Step 1: create the Legacy company once, idempotently. Guarded by
-- NOT EXISTS rather than relying only on the migration runner, so
-- this statement stays safe even if ever re-run by hand.
INSERT INTO companies (name, legal_name, status)
SELECT 'Legacy / Migrated Data', 'Legacy / Migrated Data', 'ACTIVE'
WHERE NOT EXISTS (
  SELECT 1 FROM companies WHERE name = 'Legacy / Migrated Data'
);

-- Step 2: backfill OWNER membership for every user who owns at least
-- one existing trip. ON CONFLICT DO NOTHING makes this safe to re-run.
INSERT INTO company_users (company_id, user_id, role_id, status)
SELECT
  legacy.id,
  owners.user_id,
  owner_role.id,
  'ACTIVE'
FROM (SELECT DISTINCT user_id FROM trips) owners
CROSS JOIN (
  SELECT id FROM companies WHERE name = 'Legacy / Migrated Data'
) legacy
CROSS JOIN (
  SELECT id FROM roles WHERE company_id IS NULL AND name = 'OWNER'
) owner_role
ON CONFLICT (company_id, user_id) DO NOTHING;
