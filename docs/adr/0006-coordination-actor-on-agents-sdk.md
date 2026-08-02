# Coordination actor built on the Cloudflare Agents SDK, behind the MessagingProvider seam

**Status:** accepted

## Context

[ADR-0001](0001-per-user-durable-object-coordination-d1-ledger.md) fixed the coordination
layer as a per-user **Durable Object (SQLite backend)** holding pending drafts +
conversation context, using `alarm()` for confirmation timeouts (EC-IMG-05), with D1 as
the ledger system-of-record. It deferred *how* to build that actor — raw Durable Object
class, or the **Cloudflare Agents SDK** (a first-party wrapper over Durable Objects) — to
this ticket.

Facts gathered from current Cloudflare docs (`developers.cloudflare.com/agents`):

- The Agents SDK **is** built on Durable Objects — "Agents require Cloudflare Durable
  Objects"; each `Agent` instance is a DO, addressed by name (`getAgentByName(user_id)`
  → same instance).
- It exposes `this.sql` (tagged-template SQL over the embedded SQLite), `this.state` /
  `setState()` / `onStateChanged()`, and `this.env` for bindings (D1 accessible normally).
- **Scheduling**: `this.schedule(delay | Date | cron, method, payload)`, `scheduleEvery`,
  `cancelSchedule`, `listSchedules`. It uses **DO alarms under the hood, multiplexed
  through the single alarm slot** into a SQLite table — so many concurrent schedules
  coexist on the one alarm a raw DO gives you.
- Lifecycle hooks: `onStart`, `onRequest` (HTTP), `onConnect`/`onMessage`/`onClose`
  (WebSocket), `onEmail`.

## Decision

Build the coordination actor as an **Agents SDK `Agent` subclass**, one instance per
user (`getAgentByName(user_id)`).

The deciding factor is **alarm multiplexing**. A raw DO has exactly **one** `alarm()`;
ADR-0001's confirmation-timeout requirement (EC-IMG-05) — and any case with more than one
concurrent timeout (multiple pending drafts, or a timeout alongside anything else
time-based) — would force us to hand-roll a schedule table and alarm-rebuild logic. The
SDK already provides exactly that, plus SQLite + state helpers for the pending draft and
conversation context. It is first-party and purpose-built for the per-user stateful chat
actor shape, so it is not a speculative third-party dependency.

### How we use it — the guardrail

- The actor sits **behind** the [`MessagingProvider` seam](0004-messaging-provider-seam.md).
  It consumes an already-**normalized inbound message** (ADR-0004) and never sees a
  Telegram/WhatsApp payload — so no provider shape, and no SDK shape, leaks into core
  logic (FR-CH-03, EC-CH-03). The webhook Worker resolves identity, then invokes the
  actor by `user_id` and calls a plain method with the normalized message.
- We adopt the SDK **only** as a stateful actor + scheduler. We do **not** adopt its
  WebSocket chat model or client-state-sync (`setState` broadcasting) — ingress is
  webhooks, not WebSocket, so there are no connected clients. Pending-draft and
  conversation-context rows live in `this.sql` (structured tables), not `state`.
- AI parsing ([ADR-0005](0005-ai-text-parsing-contract.md), a plain `env.AI.run` call)
  and the double-entry commit into D1 ([ADR-0002](0002-double-entry-ledger-schema.md))
  stay in the app layer, invoked from the actor — not delegated to any SDK opinion. So
  SDK lock-in is contained to the coordination layer.

## Considered options

- **Raw Durable Object class** — rejected: minimal dependency surface and zero
  abstraction, but re-implements schedule-multiplexing over the single `alarm()` plus the
  state/SQL helpers the SDK gives for free, for a component whose exact shape (per-user
  stateful chat actor with timeouts) is what the SDK exists to serve.

## Consequences

- Confirmation timeouts (EC-IMG-05) and any future per-user scheduling are first-class
  (`this.schedule`/`cancelSchedule`) rather than hand-rolled.
- Adds the `agents` SDK dependency and its `Agent` binding to `wrangler.jsonc`; still a
  single Durable Object migration under the hood.
- The actor stays testable and provider-agnostic because its input is the ADR-0004
  normalized message, not an SDK- or channel-specific shape.
- Traces: EC-IMG-05, EC-LDG-02, FR-CH-03, EC-CH-03, NFR-PERF-01; builds on ADR-0001,
  ADR-0002, ADR-0004, ADR-0005.
