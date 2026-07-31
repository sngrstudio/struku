# 09 — Foundation: bindings, ledger-core migration, test harness

**What to build:** The scaffold every later slice of tracer-bullet #1 stands on. Not
user-facing on its own: wire the Cloudflare bindings and the first D1 migration so the
Worker boots against a real ledger schema, seed the reference data, and stand up the test
harness that slices 10–13 write their behavioral tests against. This is the "make the change
easy" prefactor — done first so the vertical slices that follow stay green.

Grounded in [spec.md](../spec.md) and ADR-0001/0002/0006.

**Approach note (data access) — no ORM in tracer #1.** Do **not** adopt Drizzle (or any
ORM) here. Reasons: the strongest requirement, `user_id`-scoped tenant isolation
(NFR-SEC-07), is not enforced by an ORM anyway — it's best served by a thin, typed,
per-user-scoped **repository** over D1 prepared statements as a single reviewable choke
point. The schema is small and ADR-frozen with load-bearing CHECK constraints, so migrations
are **hand-written SQL** (verbatim ADR-0002 DDL). The Agent's embedded SQLite stays on the
SDK's `this.sql`. Zod guards only the external AI boundary. Revisit an ORM (Drizzle-for-D1
only) when reporting/aggregation lands — that's where a query builder earns its keep.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] D1 (ledger), the Agents SDK `Agent` Durable Object (with its migration), and the Workers AI (`AI`) bindings are declared in `wrangler.json`; the `agents` SDK is added to `package.json`; `wrangler types` regenerates cleanly.
- [ ] The first D1 migration creates the ADR-0002 ledger core — `currencies`, `users`, `channel_identities`, `accounts`, `journal_entries`, `journal_lines` — plus the nullable `users.onboarding_completed_at` (ADR-0003), matching the ADR-0002 DDL: integer `amount_minor`, `direction` enum, single-currency-per-entry (denormalized onto `journal_entries.currency`), currency NOT NULL on asset/liability accounts only (CHECK), slug-anchored accounts with `is_default`, append-only `status` + `reverses_entry_id`, text UUIDv7 PKs, explicit `user_id` on every user-scoped table (including `journal_lines`) with `user_id`-leading indexes.
- [ ] `currencies` is seeded with at least IDR (exponent 0) and USD (exponent 2).
- [ ] The canonical default chart of accounts (ADR-0002's slug → type → default name → currency-policy table) is captured as one seed definition, to be applied at provisioning in slice 11 — not yet inserted per-user here.
- [ ] `vitest-pool-workers` is configured; a smoke test boots the Worker with real D1 + DO bindings, applies the migration, and asserts the schema + reference seed are present — green in CI.
