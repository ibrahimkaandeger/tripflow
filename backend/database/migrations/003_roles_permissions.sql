-- Adds roles, permissions and role_permissions. Purely additive.
--
-- Role scoping model:
--   - roles.company_id IS NULL  -> a global/system role (OWNER, ADMIN,
--     MANAGER, STAFF), usable by any company's company_users rows.
--   - roles.company_id NOT NULL -> a custom role that belongs to that
--     one company only (tenant-scoped).
--
-- A plain UNIQUE(company_id, name) does NOT stop two global roles from
-- sharing a name, because SQL never treats NULL = NULL for uniqueness
-- purposes. A partial unique index (roles_global_name_key) closes that
-- gap for the company_id IS NULL group specifically; the composite
-- constraint below still correctly protects per-company custom role
-- names since company_id is never null there.
--
-- Companies are soft-deleted via status (see 002_companies.sql), but
-- roles/role_permissions still define ON DELETE CASCADE against
-- companies/roles/permissions for the rare case of a real hard delete
-- (e.g. cleaning up a company created by mistake).

CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  company_id INTEGER,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_roles_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT roles_company_name_key UNIQUE (company_id, name)
);

CREATE UNIQUE INDEX IF NOT EXISTS roles_global_name_key ON roles (name) WHERE company_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_roles_company_id ON roles (company_id);

CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) NOT NULL,
  description TEXT,
  CONSTRAINT permissions_key_key UNIQUE (key)
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id SERIAL PRIMARY KEY,
  role_id INTEGER NOT NULL,
  permission_id INTEGER NOT NULL,
  CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
  CONSTRAINT role_permissions_role_permission_key UNIQUE (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions (role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions (permission_id);

-- Permission catalog (reference data the authorization layer depends
-- on to exist; not sample/demo data, so it lives in the migration
-- rather than database/seeds/).
INSERT INTO permissions (key, description) VALUES
  ('company.read', 'Şirket bilgilerini görüntüleme'),
  ('company.update', 'Şirket bilgilerini güncelleme'),
  ('company.delete', 'Şirketi silme/pasifleştirme'),
  ('users.read', 'Şirket kullanıcılarını (personel) görüntüleme'),
  ('users.create', 'Şirkete yeni kullanıcı (personel) ekleme'),
  ('users.update', 'Şirket kullanıcısını güncelleme'),
  ('users.delete', 'Şirket kullanıcısını kaldırma'),
  ('roles.read', 'Rolleri görüntüleme'),
  ('roles.create', 'Yeni rol oluşturma'),
  ('roles.update', 'Rol güncelleme'),
  ('roles.delete', 'Rol silme'),
  ('tours.read', 'Turları görüntüleme'),
  ('tours.create', 'Yeni tur oluşturma'),
  ('tours.update', 'Tur güncelleme'),
  ('tours.delete', 'Tur silme'),
  ('participants.read', 'Katılımcıları görüntüleme'),
  ('participants.create', 'Yeni katılımcı ekleme'),
  ('participants.update', 'Katılımcı güncelleme'),
  ('participants.delete', 'Katılımcı silme'),
  ('flights.read', 'Uçuşları görüntüleme'),
  ('flights.create', 'Yeni uçuş ekleme'),
  ('flights.update', 'Uçuş güncelleme'),
  ('flights.delete', 'Uçuş silme'),
  ('hotels.read', 'Otelleri görüntüleme'),
  ('hotels.create', 'Yeni otel ekleme'),
  ('hotels.update', 'Otel güncelleme'),
  ('hotels.delete', 'Otel silme'),
  ('activities.read', 'Aktiviteleri görüntüleme'),
  ('activities.create', 'Yeni aktivite ekleme'),
  ('activities.update', 'Aktivite güncelleme'),
  ('activities.delete', 'Aktivite silme'),
  ('announcements.read', 'Duyuruları görüntüleme'),
  ('announcements.create', 'Yeni duyuru oluşturma'),
  ('announcements.update', 'Duyuru güncelleme'),
  ('announcements.delete', 'Duyuru silme'),
  ('documents.read', 'Belgeleri görüntüleme'),
  ('documents.create', 'Yeni belge ekleme'),
  ('documents.update', 'Belge güncelleme'),
  ('documents.delete', 'Belge silme'),
  ('finance.read', 'Finansal kayıtları görüntüleme'),
  ('finance.create', 'Yeni finansal kayıt ekleme'),
  ('finance.update', 'Finansal kayıt güncelleme'),
  ('finance.delete', 'Finansal kayıt silme'),
  ('reports.read', 'Raporları görüntüleme')
ON CONFLICT (key) DO NOTHING;

-- Default global roles, shared by every company unless/until it adds
-- its own custom roles (company_id NOT NULL rows).
INSERT INTO roles (company_id, name, description) VALUES
  (NULL, 'OWNER', 'Şirketin sahibi; tüm yetkilere sahiptir.'),
  (NULL, 'ADMIN', 'Şirket yöneticisi; şirketi silme hariç tüm yetkilere sahiptir.'),
  (NULL, 'MANAGER', 'Operasyon yöneticisi; turları, katılımcıları, uçuş/otel/finans kayıtlarını yönetir (silme yetkisi kısıtlı).'),
  (NULL, 'STAFF', 'Saha personeli; çoğunlukla görüntüleme ve günlük programı güncelleme yetkisine sahiptir.')
ON CONFLICT (name) WHERE company_id IS NULL DO NOTHING;

-- OWNER: every permission.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.company_id IS NULL AND r.name = 'OWNER'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ADMIN: everything except deleting the company itself.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.company_id IS NULL AND r.name = 'ADMIN' AND p.key <> 'company.delete'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- MANAGER: read access everywhere, full operational CRUD, but no
-- company/user/role management and no finance deletion.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.company_id IS NULL AND r.name = 'MANAGER' AND p.key IN (
  'company.read',
  'users.read',
  'roles.read',
  'tours.read', 'tours.create', 'tours.update', 'tours.delete',
  'participants.read', 'participants.create', 'participants.update', 'participants.delete',
  'flights.read', 'flights.create', 'flights.update', 'flights.delete',
  'hotels.read', 'hotels.create', 'hotels.update', 'hotels.delete',
  'activities.read', 'activities.create', 'activities.update', 'activities.delete',
  'announcements.read', 'announcements.create', 'announcements.update', 'announcements.delete',
  'documents.read', 'documents.create', 'documents.update', 'documents.delete',
  'finance.read', 'finance.create', 'finance.update',
  'reports.read'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- STAFF: read-heavy, plus the day-to-day writes a field operator needs.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.company_id IS NULL AND r.name = 'STAFF' AND p.key IN (
  'company.read',
  'users.read',
  'roles.read',
  'tours.read',
  'participants.read', 'participants.update',
  'flights.read',
  'hotels.read',
  'activities.read', 'activities.create', 'activities.update',
  'announcements.read',
  'documents.read',
  'finance.read',
  'reports.read'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;
