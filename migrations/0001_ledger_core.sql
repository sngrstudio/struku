-- Migration 0001 — ADR-0002 ledger core + ADR-0003 onboarding completion marker.
--
-- Hand-written SQL, no ORM (tracer #1 decision: see .scratch/struku-v1/issues/09).
-- DDL is the ADR-0002 schema sketch made real, verbatim in shape: integer minor
-- units, explicit direction enum, single-currency-per-entry (denormalized onto
-- journal_entries.currency), currency NOT NULL on asset/liability accounts only
-- (CHECK), slug-anchored accounts, append-only entry lifecycle, text UUIDv7 PKs,
-- explicit user_id on every user-scoped table (incl. journal_lines) with
-- user_id-leading indexes (NFR-SEC-07).

-- Reference (not user-scoped) ------------------------------------------------
CREATE TABLE currencies (
  code      TEXT PRIMARY KEY,          -- ISO 4217, e.g. 'IDR','USD'
  exponent  INTEGER NOT NULL,          -- minor-unit digits: IDR=0, USD=2, KWD=3
  name      TEXT NOT NULL
);

-- Seed reference currencies (FR-CUR-01). Idempotent for re-run safety.
INSERT OR IGNORE INTO currencies (code, exponent, name) VALUES
  ('IDR', 0, 'Indonesian Rupiah'),
  ('USD', 2, 'US Dollar');

-- Users ----------------------------------------------------------------------
CREATE TABLE users (
  id                    TEXT PRIMARY KEY,   -- uuidv7
  display_name          TEXT,
  subscription_tier     TEXT NOT NULL DEFAULT 'free',
  primary_currency      TEXT NOT NULL DEFAULT 'IDR' REFERENCES currencies(code),
  locale                TEXT NOT NULL DEFAULT 'id-ID',
  onboarding_completed_at INTEGER,          -- ADR-0003 §6; NULL = still onboarding
  created_at            INTEGER NOT NULL    -- unix epoch millis
);

CREATE TABLE channel_identities (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  channel     TEXT NOT NULL,           -- 'telegram' | 'whatsapp'
  external_id TEXT NOT NULL,           -- telegram chat id / phone number
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL,
  UNIQUE (channel, external_id)        -- one external identity -> one user
);                                     -- NO unique on user_id: multiple per user (FR-CH-05)
CREATE INDEX idx_channel_identities_user ON channel_identities(user_id);

CREATE TABLE accounts (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  slug       TEXT NOT NULL,            -- stable canonical key, survives rename
  type       TEXT NOT NULL CHECK (type IN ('asset','liability','equity','income','expense')),
  name       TEXT NOT NULL,            -- display only, user-renamable
  currency   TEXT REFERENCES currencies(code),   -- NOT NULL for asset/liability, NULL otherwise
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  UNIQUE (user_id, slug),
  CHECK (
    (type IN ('asset','liability')         AND currency IS NOT NULL) OR
    (type IN ('equity','income','expense') AND currency IS NULL)
  )
);
CREATE INDEX idx_accounts_user_type ON accounts(user_id, type);

CREATE TABLE journal_entries (
  id                TEXT PRIMARY KEY,  -- uuidv7, DO-minted
  user_id           TEXT NOT NULL REFERENCES users(id),
  entry_date        TEXT NOT NULL,     -- accounting date 'YYYY-MM-DD'
  description       TEXT,
  source            TEXT NOT NULL CHECK (source IN ('text','image')),
  currency          TEXT NOT NULL REFERENCES currencies(code),  -- single-currency-per-entry invariant
  status            TEXT NOT NULL DEFAULT 'posted'
                    CHECK (status IN ('posted','reversed','reversal')),
  reverses_entry_id TEXT REFERENCES journal_entries(id),
  created_at        INTEGER NOT NULL   -- immutable; no updated_at (append-only)
);
CREATE INDEX idx_journal_entries_user_date ON journal_entries(user_id, entry_date);

CREATE TABLE journal_lines (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id),   -- denormalized for NFR-SEC-07
  entry_id     TEXT NOT NULL REFERENCES journal_entries(id),
  account_id   TEXT NOT NULL REFERENCES accounts(id),
  direction    TEXT NOT NULL CHECK (direction IN ('debit','credit')),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency     TEXT NOT NULL REFERENCES currencies(code)
);
CREATE INDEX idx_journal_lines_entry   ON journal_lines(user_id, entry_id);
CREATE INDEX idx_journal_lines_account ON journal_lines(user_id, account_id);
