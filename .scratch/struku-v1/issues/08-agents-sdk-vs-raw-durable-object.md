# 08 — Coordination actor: Agents SDK vs raw Durable Object

Type: grilling
Status: resolved
Blocked by: —

## Question

ADR-0001 fixed the coordination layer as a per-user Durable Object (SQLite backend).
Decide *how* to build that actor: on the **Cloudflare Agents SDK** (a purpose-built
chat-agent wrapper over Durable Objects — state, scheduling, SQL storage, message
handling, routing helpers) or a **raw Durable Object class**.

Weigh:
- Agents SDK ergonomics + built-in scheduling/state/routing vs an added dependency and
  abstraction lock-in.
- Whether the SDK's opinions (its message/state model) fit cleanly under the
  `MessagingProvider` seam (#04) without leaking provider- or SDK-specific shapes into
  core logic (FR-CH-03, EC-CH-03).
- Whether `alarm()` / scheduling and D1 access we need are first-class in the SDK.

Deliverable: ADR picking one, with the rejection reason recorded. Does not block the
ledger schema (#03), but informs the eventual build of the coordination actor.

## Answer

→ [ADR-0006](../../../docs/adr/0006-coordination-actor-on-agents-sdk.md)

Build the actor on the **Cloudflare Agents SDK** (`Agent` subclass, one per user via
`getAgentByName(user_id)`). Deciding factor: the SDK **multiplexes many schedules over a
DO's single `alarm()`** (`this.schedule`/`cancelSchedule`) — exactly ADR-0001's
confirmation-timeout need (EC-IMG-05), which raw DO would force us to hand-roll. It's
first-party, built on DO+SQLite (the ADR-0001 substrate), so not a speculative dependency.

**Guardrail:** SDK sits **behind** the MessagingProvider seam (#04) — consumes the
ADR-0004 normalized message, never a channel/SDK shape (FR-CH-03/EC-CH-03). Used only as
stateful actor + scheduler; **not** its WebSocket/state-sync model (webhook ingress, no
clients). Pending draft/context in `this.sql`; AI parsing (ADR-0005) + D1 commit
(ADR-0002) stay app-layer. Rejected raw DO: re-implements schedule-multiplexing + state
helpers the SDK gives free, for the exact shape the SDK exists to serve.
