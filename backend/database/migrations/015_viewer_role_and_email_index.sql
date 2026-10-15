-- Phase: production hardening. Purely additive, idempotent.
--
-- 1. VIEWER global role: read-only access to day-to-day operations.
--    Deliberately excludes finance.read (money data is not "general
--    read" access) and every create/update/delete key. Like the other
--    global roles, companies assign it through company_users; it can't
--    be edited through the API (global roles are read-only there).
--
-- 2. Case-insensitive uniqueness for users.email. Registration/login
--    now normalize emails to lowercase and compare with LOWER(email);
--    this index makes "Ali@x.com" vs "ali@x.com" duplicates impossible
--    at the database level too (checked beforehand: no such duplicates
--    exist in any environment this migration was run against).
--
-- Rollback recipe (manual, not executed here):
--   DROP INDEX IF EXISTS users_email_lower_key;
--   DELETE FROM roles WHERE company_id IS NULL AND name = 'VIEWER';
--     (only possible while no company_users row references it)

INSERT INTO roles (company_id, name, description) VALUES
  (NULL, 'VIEWER', 'Salt okunur kullanıcı; operasyon verilerini görüntüler, finans verilerini ve değişiklik yetkilerini içermez.')
ON CONFLICT (name) WHERE company_id IS NULL DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.company_id IS NULL AND r.name = 'VIEWER' AND p.key IN (
  'company.read',
  'users.read',
  'roles.read',
  'tours.read',
  'participants.read',
  'flights.read',
  'hotels.read',
  'activities.read',
  'announcements.read',
  'documents.read',
  'reports.read'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key ON users (LOWER(email));
