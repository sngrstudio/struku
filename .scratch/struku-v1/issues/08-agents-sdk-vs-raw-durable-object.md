# 08 — Coordination actor: Agents SDK vs raw Durable Object

Type: grilling
Status: open
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

_(ADR link)_
