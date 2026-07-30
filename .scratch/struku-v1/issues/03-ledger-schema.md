# 03 — Ledger schema design

Type: grilling
Status: open
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

_(ADR link + schema sketch)_
