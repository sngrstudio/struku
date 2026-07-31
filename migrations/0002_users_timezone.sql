-- Migration 0002 — users.timezone (ADR-0003 §2/FR-ONB-03).
--
-- Missed in migration 0001: onboarding collects four baseline preferences
-- (language, display name, currency, timezone) but the ledger-core DDL only
-- carried three. Timezone resolves "today" for transactions with no stated
-- date (spec: date: null -> app fills today-in-user-timezone).
ALTER TABLE users ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta';
