-- Adds the `companies` table: the tenant root entity for the B2B/B2C
-- model. Purely additive — no existing table is touched, and this
-- table has no foreign keys of its own since it sits at the top of
-- the hierarchy (company_users, tours, etc. will reference it from
-- later migrations).
--
-- Soft delete: companies are deactivated via `status`, never hard
-- deleted, so nothing else ever needs an ON DELETE decision against
-- this table for the tenant row itself.

CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  legal_name VARCHAR(200),
  email VARCHAR(255),
  phone VARCHAR(50),
  website VARCHAR(255),
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100),
  tax_number VARCHAR(50),
  logo_url TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT companies_status_check CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
  CONSTRAINT companies_email_key UNIQUE (email),
  CONSTRAINT companies_tax_number_key UNIQUE (tax_number)
);
