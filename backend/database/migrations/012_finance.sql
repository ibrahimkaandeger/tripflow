-- Tour Operation Finance. Purely additive: no existing table is
-- dropped or has data touched. Two changes:
--   1. tour_participants gains sale_price/sale_currency/payment_status
--      (ADD COLUMN, existing rows unaffected -- table is currently
--      empty anyway).
--   2. New table finance_transactions.
-- No backfill (no finance data exists in the prototype).
--
-- Scope, per explicit instruction: Tour Operation Finance only. The
-- following are deliberately NOT built here, left for a later,
-- separate Company Accounting/Finance phase: bank_accounts,
-- cash_accounts, credit_cards, suppliers, customer_accounts,
-- accounting_accounts, tax_records, exchange_rates, invoices,
-- bank_transactions, reconciliation_records. finance_transactions is
-- kept general enough (company_id, category, description,
-- reference_number) that those can attach to it later without a
-- structural change here.
--
-- Sale price vs. payment, kept strictly separate as instructed:
--   - tour_participants.sale_price/sale_currency is the agreed
--     booking amount -- independent of whatever has actually been
--     paid.
--   - finance_transactions rows are the real money movements
--     (payments, refunds, expenses). "Paid" and "balance" are always
--     derived by aggregating finance_transactions against
--     sale_price, never stored redundantly.
--
-- payment_status is kept as a plain, manually-set column this phase
-- (no aggregation trigger, as explicitly allowed) -- a future phase
-- can compute it from completed INCOME/REFUND participant
-- transactions, being careful about currency mismatches.
--
-- Currency: TRY/EUR/USD/GBP only, no conversion. A transaction's
-- currency is expected to match its participant's sale_currency, but
-- this is NOT enforced at the database level here -- the spec frames
-- it as a dashboard-aggregation concern ("balance hesaplama
-- yapılmamalı" when currencies differ), not a rejection rule, and
-- building real multi-currency conversion is explicitly out of scope
-- this phase.
--
-- Deletion behavior for finance_transactions, all deliberate:
--   - company_id/tour_id -> RESTRICT (explicit): a finance record is
--     a record of something that already happened; the company or
--     tour it happened under can't be deleted while it still exists.
--   - created_by -> RESTRICT (explicit): keeps the audit trail
--     meaningful.
--   - participant_id -> SET NULL (explicit, with reasoning given in
--     the instructions themselves): deleting a participant must not
--     delete the money movement that already happened, only detach
--     the now-gone participant from it.
--
-- Immutability: a hard "rows can never be deleted" trigger was
-- considered and deliberately NOT added. That would (a) contradict
-- the explicit instruction not to build a fully immutable ledger,
-- and (b) fight the equally explicit requirement to clean up test
-- data at the end of this very migration's test run. Instead,
-- deletion protection is left to the application layer (the future
-- API is expected to never expose a hard-delete endpoint for
-- finance_transactions and to use status = 'CANCELLED' for reversals
-- instead) -- the "or leave it to a controlled application-layer
-- structure" alternative the instructions explicitly allowed.

ALTER TABLE tour_participants ADD COLUMN IF NOT EXISTS sale_price NUMERIC(12, 2);
ALTER TABLE tour_participants ADD COLUMN IF NOT EXISTS sale_currency VARCHAR(3);
ALTER TABLE tour_participants ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) NOT NULL DEFAULT 'UNPAID';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tour_participants_sale_price_check') THEN
    ALTER TABLE tour_participants
      ADD CONSTRAINT tour_participants_sale_price_check CHECK (sale_price IS NULL OR sale_price > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tour_participants_sale_currency_check') THEN
    ALTER TABLE tour_participants
      ADD CONSTRAINT tour_participants_sale_currency_check CHECK (sale_currency IS NULL OR sale_currency IN ('TRY', 'EUR', 'USD', 'GBP'));
  END IF;

  -- If a price is set, a currency must be too (the reverse is not
  -- required: a currency alone with no price yet is meaningless, but
  -- nothing depends on rejecting that combination, so it's not
  -- forced).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tour_participants_sale_price_currency_check') THEN
    ALTER TABLE tour_participants
      ADD CONSTRAINT tour_participants_sale_price_currency_check CHECK (sale_price IS NULL OR sale_currency IS NOT NULL);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tour_participants_payment_status_check') THEN
    ALTER TABLE tour_participants
      ADD CONSTRAINT tour_participants_payment_status_check CHECK (payment_status IN ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tour_participants_payment_status ON tour_participants (payment_status);

CREATE TABLE IF NOT EXISTS finance_transactions (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL,
  tour_id INTEGER NOT NULL,
  participant_id INTEGER,
  type VARCHAR(20) NOT NULL,
  category VARCHAR(30) NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  transaction_date DATE NOT NULL,
  description TEXT,
  reference_number VARCHAR(50),
  created_by INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_finance_transactions_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT,
  CONSTRAINT fk_finance_transactions_tour FOREIGN KEY (tour_id) REFERENCES tours(id) ON DELETE RESTRICT,
  CONSTRAINT fk_finance_transactions_participant FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE SET NULL,
  CONSTRAINT fk_finance_transactions_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT finance_transactions_amount_check CHECK (amount > 0),
  CONSTRAINT finance_transactions_currency_check CHECK (currency IN ('TRY', 'EUR', 'USD', 'GBP')),
  CONSTRAINT finance_transactions_status_check CHECK (status IN ('PENDING', 'COMPLETED', 'CANCELLED')),
  CONSTRAINT finance_transactions_type_check CHECK (type IN ('INCOME', 'EXPENSE', 'REFUND')),
  CONSTRAINT finance_transactions_category_check CHECK (category IN (
    'PARTICIPANT_PAYMENT', 'TOUR_SALE',
    'HOTEL', 'FLIGHT', 'TRANSPORT', 'FOOD', 'GUIDE', 'ACTIVITY', 'INSURANCE', 'VISA',
    'PARTICIPANT_REFUND', 'OTHER'
  )),
  -- Exactly the type/category pairing given in the spec. Not a
  -- general-purpose accounting rules engine -- just closes off the
  -- combinations that make no business sense (e.g. HOTEL as an
  -- INCOME, or PARTICIPANT_REFUND as an EXPENSE).
  CONSTRAINT finance_transactions_type_category_check CHECK (
    (type = 'INCOME' AND category IN ('PARTICIPANT_PAYMENT', 'TOUR_SALE')) OR
    (type = 'EXPENSE' AND category IN ('HOTEL', 'FLIGHT', 'TRANSPORT', 'FOOD', 'GUIDE', 'ACTIVITY', 'INSURANCE', 'VISA', 'OTHER')) OR
    (type = 'REFUND' AND category = 'PARTICIPANT_REFUND')
  ),
  -- NULL reference_number never conflicts with anything (many
  -- transactions per company with no reference is normal); when set,
  -- it must be unique within that company but the same value is free
  -- to reuse in a different company.
  CONSTRAINT finance_transactions_company_reference_key UNIQUE (company_id, reference_number)
);

CREATE INDEX IF NOT EXISTS idx_finance_transactions_company_id ON finance_transactions (company_id);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_tour_id ON finance_transactions (tour_id);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_participant_id ON finance_transactions (participant_id);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_type ON finance_transactions (type);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_category ON finance_transactions (category);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_status ON finance_transactions (status);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_transaction_date ON finance_transactions (transaction_date);
-- Compound indexes matching the dashboard aggregation queries this
-- phase's spec describes directly (SUM(amount) WHERE type=... AND
-- status=..., grouped by tour or by participant).
CREATE INDEX IF NOT EXISTS idx_finance_transactions_tour_type_status ON finance_transactions (tour_id, type, status);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_participant_type_status ON finance_transactions (participant_id, type, status);

-- Tenant consistency guard, combining both required checks on this
-- one table:
--   1. company_id must be the actual owning company of tour_id
--      (rejects Company A transaction filed against a Company B tour).
--   2. if participant_id is set, that participant must belong to
--      company_id AND be registered on tour_id via tour_participants
--      (rejects a Company B participant, and rejects a Company A
--      participant who is registered on a DIFFERENT Company A tour).
CREATE OR REPLACE FUNCTION check_finance_transaction_consistency()
RETURNS TRIGGER AS $$
DECLARE
  tour_company_id INTEGER;
  participant_found BOOLEAN;
  is_registered BOOLEAN;
BEGIN
  SELECT company_id INTO tour_company_id FROM tours WHERE id = NEW.tour_id;

  IF tour_company_id IS NULL THEN
    RAISE EXCEPTION 'finance_transactions: referenced tour does not exist';
  END IF;

  IF tour_company_id <> NEW.company_id THEN
    RAISE EXCEPTION 'finance_transactions: tour % belongs to company %, not company %', NEW.tour_id, tour_company_id, NEW.company_id;
  END IF;

  IF NEW.participant_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM participants WHERE id = NEW.participant_id AND company_id = NEW.company_id
    ) INTO participant_found;

    IF NOT participant_found THEN
      RAISE EXCEPTION 'finance_transactions: participant % does not belong to company %', NEW.participant_id, NEW.company_id;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM tour_participants tp
      WHERE tp.tour_id = NEW.tour_id AND tp.participant_id = NEW.participant_id
    ) INTO is_registered;

    IF NOT is_registered THEN
      RAISE EXCEPTION 'finance_transactions: participant % is not registered on tour %', NEW.participant_id, NEW.tour_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_transaction_consistency ON finance_transactions;
CREATE TRIGGER trg_finance_transaction_consistency
  BEFORE INSERT OR UPDATE ON finance_transactions
  FOR EACH ROW
  EXECUTE FUNCTION check_finance_transaction_consistency();

-- Dashboard aggregation needs no extra structure, computed directly,
-- e.g.:
--   Total Income:    SUM(amount) WHERE type='INCOME'  AND status='COMPLETED'
--   Total Expense:   SUM(amount) WHERE type='EXPENSE' AND status='COMPLETED'
--   Total Refund:    SUM(amount) WHERE type='REFUND'  AND status='COMPLETED'
--   Net Operational Result: Income - Expense - Refund
--   Participant Paid:      SUM(amount) WHERE type='INCOME' AND status='COMPLETED' AND participant_id=$1
--   Participant Refunded:  SUM(amount) WHERE type='REFUND' AND status='COMPLETED' AND participant_id=$1
--   Participant Balance:   tour_participants.sale_price - (Paid - Refunded), only when currencies match

-- Rollback recipe (manual, not executed here -- no other table's
-- data is ever touched by it; tour_participants keeps its new
-- columns until explicitly dropped too):
--   DROP TRIGGER IF EXISTS trg_finance_transaction_consistency ON finance_transactions;
--   DROP FUNCTION IF EXISTS check_finance_transaction_consistency();
--   DROP TABLE IF EXISTS finance_transactions;
--   ALTER TABLE tour_participants DROP CONSTRAINT IF EXISTS tour_participants_payment_status_check;
--   ALTER TABLE tour_participants DROP CONSTRAINT IF EXISTS tour_participants_sale_price_currency_check;
--   ALTER TABLE tour_participants DROP CONSTRAINT IF EXISTS tour_participants_sale_currency_check;
--   ALTER TABLE tour_participants DROP CONSTRAINT IF EXISTS tour_participants_sale_price_check;
--   ALTER TABLE tour_participants DROP COLUMN IF EXISTS payment_status;
--   ALTER TABLE tour_participants DROP COLUMN IF EXISTS sale_currency;
--   ALTER TABLE tour_participants DROP COLUMN IF EXISTS sale_price;
