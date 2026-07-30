# 02 — State & concurrency architecture (spine definer)

Type: prototype
Status: resolved
Blocked by: —

## Question

Cloudflare Workers are stateless V8 isolates. Decide **where three pieces of
per-user state live**, because everything downstream (schema, onboarding, editing,
confirmation timeouts) hangs off this:

1. **Ledger write serialization** — two near-simultaneous confirmations on the same
   user's ledger must not lose/duplicate an entry (EC-LDG-02).
2. **Pending-confirmation draft state** — a parsed-but-uncommitted transaction awaiting
   ✅/✏️/❌ (FR-IMG-04/05, FR-TXT-03), including its **timeout/expiry** (EC-IMG-05).
3. **Conversational context** for a user across messages (in-flight onboarding step,
   "did you mean this transaction?" follow-ups).

Candidate shapes to spike/compare:

- **Durable Object per `user_id`** — natural actor: single-threaded serialization for
  free, holds pending-draft + convo state, `alarm()` for confirmation timeouts; ledger
  writes go through the DO (its SQLite storage, or DO-coordinated D1 writes).
- **D1-only + optimistic concurrency / conditional writes** — simpler infra, but must
  hand-roll serialization + a separate mechanism for pending-draft TTL and timeout wakeups.
- **Hybrid** — DO for coordination/state, D1 as system-of-record for the ledger.

Deliverable: an ADR picking the model + a cheap spike (via `/prototype`) proving the
pending-draft→confirm→commit→timeout loop feels right for one user. Note the D1-vs-DO
choice constrains ticket #03 (schema location).

## Answer

**Decision → [ADR-0001](../../../docs/adr/0001-per-user-durable-object-coordination-d1-ledger.md).**

- **Coordination layer = per-user Durable Object (SQLite backend).** Holds pending draft
  + conversation context; `alarm()` for confirmation timeout (EC-IMG-05); single-threaded
  → ledger-write serialization for free (EC-LDG-02).
- **Ledger = D1** (cross-user-queryable system-of-record — FR-ADM-08, §3.8). Messages
  route webhook → user's DO → DO writes committed entries to D1.
- **Rejected:** D1-only + cron (hand-rolled locks/TTL/sweep); DO-SQLite-as-ledger (silo
  breaks admin cross-user queries); KV backend / Workers KV (paid-only + eventually
  consistent, no serialization, no alarms).
- **Cost:** a wash vs D1-only at both Free and Paid tiers; DO wins on less custom code.
  SQLite-backed DO is Free-plan eligible; ephemeral writes use the DO's own 100k/day pool,
  separate from D1's ledger write pool.

_Ticket typed `prototype`, but the decision was reachable via design + Cloudflare
plan/pricing facts without a throwaway spike. Recommend validating the DO
`alarm()`→confirm→commit loop for real during tracer-bullet #1's build, not as a
separate spike._

New terms recorded in `CONTEXT.md`: **Pending draft**, **Conversation context**.
Surfaced follow-on: **#08** (Agents SDK vs raw Durable Object). Unblocks **#03** (schema).
