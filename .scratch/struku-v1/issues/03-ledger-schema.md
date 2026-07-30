# 03 — Ledger schema design

Type: grilling
Status: resolved
Blocked by: 02

## Question

Design the D1 schema for the double-entry ledger core. Blocked by #02 because where
state lives (DO SQLite vs D1) shapes where/how these tables are written.

Cover, at minimum (indicative entities from PRD §6):

- `users` (profile, subscription tier, primary reporting currency, locale) — NOT tied
  to a channel.
- `channel_identities` (channel, external_id) → `user_id`; **multiple simultaneously
  active per user** (FR-CH-05).
- `accounts` — per-user chart of accounts (type: asset/liability/equity/income/expense;
  currency attribute per account, FR-LDG-04).
- `journal_entries` (header: date, description, source image/text, status).
- `journal_lines` (account_id, amount, currency, dr/cr) — each line keeps its **original
  transaction currency** (FR-CUR-02).
- Default chart-of-accounts **seeding** at onboarding (FR-LDG-01, PRD §6 default list).

Decisions to pin: how balance is enforced at the app layer before write (FR-LDG-03),
how currency is carried on lines vs accounts, `user_id` scoping as a standing invariant
(NFR-SEC-07), and how corrections will attach later (reversal vs update — FR-LDG-05,
resolved in detail by the future editing ticket, but the schema must not preclude it).

Deliverable: ADR + schema DDL sketch; add ledger terms to `CONTEXT.md`.

## Answer

Resolved → **[ADR-0002](../../../docs/adr/0002-double-entry-ledger-schema.md)** (full DDL
sketch + default chart-of-accounts seed table live there). Seven load-bearing decisions:

1. **Money** = `INTEGER amount_minor` (positive) + reference `currencies(code, exponent)`
   table (IDR=0, USD=2). Balance check integer-exact. (No float, no decimal-TEXT.)
2. **dr/cr** = explicit `direction` enum on `journal_lines`; amount always positive.
3. **Single currency per entry** in v1 — currency denormalized onto `journal_entries`;
   FX handled by converting at input, not mixing currencies in one entry. EC-LDG-01
   rounding confined to the reporting path; commit path stays integer-exact.
4. **`accounts.currency` NOT NULL for asset/liability only**, NULL for
   equity/income/expense (enforced by CHECK); asset/liability line must match its
   account currency.
5. **`slug` (stable, unique per user) + `is_default`** on accounts; `(user_id, slug)` is
   the deterministic join key for AI parsing (#05), categories (FR-LDG-02), onboarding.
   `name` is display-only/renamable. Default chart seeded from one canonical definition.
6. **Append-only lifecycle**: `status` enum `posted|reversed|reversal` +
   `reverses_entry_id`; immutable `created_at`, no `updated_at`. Reserves capacity for
   reversal **or** update-with-audit without deciding §3.7's correction flow (FR-LDG-05).
7. **UUIDv7 app/DO-minted PKs** + **explicit `user_id` on every user-scoped table**
   (incl. `journal_lines`), composite index leading on `user_id` → NFR-SEC-07 as a
   uniform, reviewable "every query filtered by `user_id`" invariant.

Balance enforcement (FR-LDG-03) is app-layer, pre-write: ≥2 lines, one currency,
`SUM(debit)==SUM(credit)`; per-user DO serializes concurrent writes (EC-LDG-02).

**Scope boundary:** ledger core only (`users`, `channel_identities`, `accounts`,
`journal_entries`, `journal_lines`, `currencies`). `attachments`, `categories`,
`budgets`, `exchange_rates`, `channel_link_requests`, `channel_configs`,
`detail_view_tokens`, `admin_audit_log` stay in the map's fog; they must respect these
invariants when introduced.

Unblocks **#06 (onboarding & identity)** — seeding + identity model now grounded.
