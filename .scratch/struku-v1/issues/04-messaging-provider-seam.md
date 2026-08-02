# 04 — `MessagingProvider` seam

Type: grilling
Status: resolved
Blocked by: —

## Question

Design the channel-agnostic seam so no provider-specific payload shape leaks into
core bot logic (FR-CH-01..03, EC-CH-03; PRD §7.1 risk). Independent of the state
model, so takeable now (use #01's captured Telegram fixtures as the concrete input).

Pin down:

- The **normalized inbound message** shape: text | image | document, sender/channel
  identity, optional reply-to-message reference (Telegram native; WhatsApp via
  `context.id`), timestamp.
- The **interface** operations: `sendText`, `sendMediaPrompt`, `sendDocument`,
  `receiveInboundMessage` (→ normalized), `sendLinkRequestCode` (FR-CH-01).
- Where the **activation gate** sits (a channel routes live iff its `channel_configs`
  row is validated/active — FR-CH-04, EC-CH-01) — interface-level vs router-level.
- How **provider-specific interactive affordances** (Telegram inline keyboards vs
  WhatsApp buttons for the ✅/✏️/❌ prompt) stay *optional enhancements* over the
  normalized core, never a required dependency (EC-CH-03).

Deliverable: ADR + interface sketch (`TelegramProvider` as first impl; `WhatsAppProvider`
stays fog). Add adapter terms to `CONTEXT.md`.

## Answer

→ [ADR-0004](../../../docs/adr/0004-messaging-provider-seam.md)

- **`sendChoicePrompt(to, text, options)`** added beyond FR-CH-01's minimum, for the
  confirm/edit/discard family of interactions — each provider renders it as native
  buttons or a plain numbered list.
- **Uniform normalization**: a button tap and a typed reply both normalize to
  `{ kind: 'text', text: <value> }` — no `choice` kind, no provider-conditional
  branching in business logic (EC-CH-03 true by construction).
- **Activation gate (FR-CH-04/EC-CH-01) lives at the router**, before any `Provider`
  call — `Provider` implementations carry zero activation-policy logic.
- **`Provider` is a stateless payload translator**: returns raw `(channel, externalId)`,
  never a resolved `user_id`. Identity resolution (`channel_identities` lookup, ADR-0003
  eager-provisioning) is a router-layer concern above the seam.
- Full interface sketch (`MessagingProvider`, `NormalizedInboundMessage`,
  `InboundParseFailure`) is in the ADR, grounded against real Telegram Bot API JSON
  shapes. `fileRef` resolution and `WhatsAppProvider` itself stay fog.
