# Double-entry ledger schema: integer minor units, single-currency entries, slug-anchored accounts

**Status:** accepted

## Context

Struku's ledger is simplified double-entry bookkeeping persisted in **D1 (SQLite)** —
the cross-user-queryable system-of-record established in
[ADR-0001](0001-per-user-durable-object-coordination-d1-ledger.md). Pending drafts and
conversation context live in the per-user Durable Object; only **committed** entries
reach D1. This ADR fixes the D1 schema for the ledger core (`users`,
`channel_identities`, `accounts`, `journal_entries`, `journal_lines`) plus the currency
reference table and the default chart-of-accounts seed.

Constraints in play: double-entry balance enforced at the app layer before any write
(FR-LDG-03), each line keeps its original transaction currency (FR-CUR-02), currency per
account (PRD §6), multiple simultaneous channels per user (FR-CH-05), strict `user_id`
multi-tenant isolation as a reviewable invariant (NFR-SEC-07), and corrections that must
not be precluded by the schema (FR-LDG-05).

## Decision

### 1. Money as integer minor units + per-currency exponent

Amounts are stored as **`INTEGER amount_minor`** (always positive). A reference
**`currencies`** table holds the ISO-4217 `exponent` per code (IDR=0, USD=2, KWD=3), so
`$12.34 → 1234`, `Rp 1.500 → 1500`. SQLite has no decimal type and IEEE-754 floats are
unsafe for money; integer arithmetic makes the balance check exact. Rejected: TEXT
decimal strings (every op needs a big-decimal lib; `SUM()` unusable for balance), and a
fixed global scale (wastes digits for IDR, truncates 3-decimal currencies).

### 2. Direction as an explicit enum

`journal_lines.direction` is an enum `'debit' | 'credit'`; `amount_minor` is always
positive. Balance check reads as `SUM(debit) == SUM(credit)`. Rejected: signed amounts
(`SUM == 0`) — terser but sign meaning is easy to invert and display needs account-type
context; and split `debit_minor`/`credit_minor` columns — wasteful, needs a
one-is-zero CHECK for no gain.

### 3. Single currency per entry (v1)

Every line in one `journal_entry` shares one currency; the currency is denormalized onto
`journal_entries.currency` to encode the invariant structurally. FR-LDG-03's "within the
same currency context" is satisfied trivially. Multi-currency economics (e.g. USD
purchase paid from an IDR card) are modelled by converting at input to a single-currency
entry, not by mixing currencies in one entry. Lines still carry their own `currency`
(FR-CUR-02) — equal to the entry currency in v1 — so the column does **not** preclude a
future multi-currency-per-entry mode. Consequence: EC-LDG-01 cross-currency rounding
lives only on the **reporting/aggregation** path (FR-CUR-05), never on the commit path,
which stays integer-exact.

### 4. Currency belongs to balance-holding accounts only

`accounts.currency` is **NOT NULL for asset/liability** accounts (real balances:
"Bank BCA" is IDR, "PayPal USD" is USD) and **NULL for equity/income/expense** accounts
(categories absorb any currency). A CHECK constraint enforces this. Invariant: a line
touching an account with a non-null currency must match it. Rejected: currency on every
account (explodes the chart into "Food (IDR)"/"Food (USD)", breaks category→account
mapping FR-LDG-02) and no currency on accounts (lets an asset balance mix currencies).

### 5. Slug-anchored accounts + `is_default`

Each account has a stable `slug` (unique per user) that does not change on rename, plus
`is_default`. Systems reference accounts by `(user_id, slug)` — the AI parser (#05),
category mapping (FR-LDG-02), and onboarding resolve targets deterministically, while
`name` is display-only and user-renamable. The default chart of accounts (FR-LDG-01) is
seeded from one canonical definition (slug → type → default name → currency policy).
Rejected: name-based lookup (rename breaks references; brittle for an AI-parsing core)
and hardcoded ids (each user has distinct account rows).

### 6. Append-only entry lifecycle with reversal capacity

`journal_entries.status` enum `'posted' | 'reversed' | 'reversal'` (default `posted`)
plus `reverses_entry_id` (NULL, set on a reversing entry). Corrections never mutate or
delete a posted row; they append. This reserves structural capacity for **either**
reversing-entry **or** update-with-audit correction styles (FR-LDG-05) without choosing
one here — that flow is owned by the future editing ticket (§3.7). Entries carry an
immutable `created_at` and **no** `updated_at`, so append-only is enforced by design and
balance integrity holds "at any point in history."

### 7. App-minted UUIDv7 PKs + explicit `user_id` everywhere

Primary keys are **text UUIDv7**, minted app/DO-side so an entry has its id while still a
draft in the DO (before the D1 write) and is time-sortable. Every user-scoped table
carries an **explicit `user_id`** column — including `journal_lines` (denormalized from
its parent entry) — with a composite index leading on `user_id`. This makes NFR-SEC-07 a
uniform, reviewable rule: every SELECT/UPDATE/DELETE on a user-scoped table has
`WHERE user_id = ?`, with no "except when JOINed" exception. Rejected: integer
autoincrement rowids (no pre-mint, enumerable) and parent-only `user_id` with JOIN-based
scoping (easy to miss, hard to audit).

## Schema sketch (DDL, illustrative — not the migration)

```sql
-- Reference (not user-scoped)
CREATE TABLE currencies (
  code      TEXT PRIMARY KEY,          -- ISO 4217, e.g. 'IDR','USD'
  exponent  INTEGER NOT NULL,          -- minor-unit digits: IDR=0, USD=2, KWD=3
  name      TEXT NOT NULL
);

CREATE TABLE users (
  id                TEXT PRIMARY KEY,   -- uuidv7
  display_name      TEXT,
  subscription_tier TEXT NOT NULL DEFAULT 'free',
  primary_currency  TEXT NOT NULL DEFAULT 'IDR' REFERENCES currencies(code),
  locale            TEXT NOT NULL DEFAULT 'id-ID',
  created_at        INTEGER NOT NULL    -- unix epoch millis
);

CREATE TABLE channel_identities (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  channel     TEXT NOT NULL,           -- 'telegram' | 'whatsapp'
  external_id TEXT NOT NULL,           -- telegram chat id / phone number
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL,
  UNIQUE (channel, external_id)        -- one external identity → one user
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
    (type IN ('asset','liability')     AND currency IS NOT NULL) OR
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
```

**Balance enforcement (FR-LDG-03), app-layer, before any D1 write:** for an entry's
lines — at least two lines; all share the entry currency; and
`SUM(amount_minor WHERE direction='debit') == SUM(amount_minor WHERE direction='credit')`.
Integer-exact; reject the whole commit on mismatch. Concurrent writes to the same user's
ledger are serialized by the per-user DO (EC-LDG-02), so no D1-level lock table is needed.

**Default chart of accounts seed (FR-LDG-01 / FR-ONB-04), canonical definition:**

| slug | type | default name | currency |
|---|---|---|---|
| `cash` | asset | Cash | primary |
| `bank` | asset | Bank Account | primary |
| `ewallet` | asset | E-Wallet | primary |
| `credit_card` | liability | Credit Card | primary |
| `personal_debt` | liability | Personal Debt | primary |
| `opening_balance` | equity | Opening Balance | NULL |
| `income_salary` | income | Salary | NULL |
| `income_freelance` | income | Freelance Income | NULL |
| `income_other` | income | Other Income | NULL |
| `expense_food` | expense | Food | NULL |
| `expense_transportation` | expense | Transportation | NULL |
| `expense_shopping` | expense | Shopping | NULL |
| `expense_bills_utilities` | expense | Bills & Utilities | NULL |
| `expense_entertainment` | expense | Entertainment | NULL |
| `expense_healthcare` | expense | Healthcare | NULL |
| `expense_other` | expense | Other | NULL |

`currency = primary` uses the user's primary reporting currency (FR-CUR-01, default IDR).
One asset account each is seeded; users add more bank/e-wallet accounts (FR-LDG-04) via
chat account management (§3.6, out of scope here).

## Scope boundary

This ADR covers the ledger core only. `attachments`, `categories`, `budgets`,
`exchange_rates`, `channel_link_requests`, `channel_configs`, `detail_view_tokens`, and
`admin_audit_log` (PRD §6) belong to their own areas and remain in the map's fog; their
introduction must respect the invariants above (integer minor units, explicit `user_id`,
slug references into `accounts`).

## Consequences

- Balance enforcement is integer-exact and reviewable; cross-currency rounding
  (EC-LDG-01) is confined to the reporting path.
- The AI parser (#05) and onboarding (#06) get a deterministic `(user_id, slug)` target
  instead of matching account names.
- Schema reserves reversal/update capacity without deciding correction flow (§3.7).
- Slight denormalization (`user_id` and `currency` repeated on lines) is accepted to make
  NFR-SEC-07 a uniform invariant and to encode single-currency-per-entry structurally.
- Traces: FR-LDG-01..05, EC-LDG-01, EC-LDG-02, FR-CUR-01, FR-CUR-02, FR-CUR-05,
  FR-CUR-06, FR-CH-05, FR-ONB-04, NFR-SEC-07.
