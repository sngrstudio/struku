# Per-user Durable Object (SQLite) for coordination; D1 as the ledger system-of-record

**Status:** accepted

## Context

Struku is a chat bot on stateless Cloudflare Workers isolates, but it needs three
kinds of per-user state that a stateless isolate can't hold: **pending drafts**
(parsed-but-uncommitted transactions awaiting confirm/edit/discard, with a timeout),
**conversation context** across messages (onboarding step, outstanding clarification),
and **serialized** writes to the double-entry ledger (EC-LDG-02). At the same time the
durable ledger must stay **queryable across users** for the Admin Console (FR-ADM-08)
and multi-tenant reporting (§3.8).

## Decision

Each user gets a **Durable Object with the SQLite storage backend** as a coordination
actor: it holds the pending draft and conversation context, uses `alarm()` for
confirmation timeouts (EC-IMG-05), and gets write-serialization for free from its
single-threaded execution (EC-LDG-02). The durable **double-entry ledger lives in D1**
as the cross-user-queryable system-of-record. Every inbound message is routed to the
user's DO, which writes committed journal entries to D1.

## Considered Options

- **D1-only + cron sweep** — rejected: hand-rolls a lock table, TTL logic, and a
  timeout-sweep cron; timeout precision is tied to cron granularity; all ephemeral +
  ledger writes contend for a single D1 write pool.
- **DO SQLite as the ledger system-of-record** — rejected: per-DO silo makes cross-user
  Admin queries (FR-ADM-08) and multi-tenant reporting a fan-out nightmare (no SQL JOIN
  across DOs).
- **DO KV storage backend / Workers KV** — rejected: the KV backend is paid-only (not
  free-plan eligible); Workers KV is eventually consistent + global, so it gives no
  read-your-writes on pending drafts, no per-user serialization, and no `alarm()`.

## Consequences

- Free-plan eligible: SQLite-backed DOs are free-tier available, and ephemeral writes
  hit the DO's own 100k/day write pool, separate from D1's ledger write pool.
- Adds a routing hop (webhook → user's DO → D1) and a DO binding.
- Cost is a wash vs D1-only at both Free and Paid tiers; the DO wins on total cost of
  ownership (less custom code). See ticket 02 for the pricing analysis.
- **Open follow-on:** build the actor on the Cloudflare Agents SDK or a raw Durable
  Object? — deferred to ADR via ticket 08.
- Traces: EC-LDG-02, EC-IMG-05, FR-ADM-08, NFR-SEC-07, NFR-PERF-01.
