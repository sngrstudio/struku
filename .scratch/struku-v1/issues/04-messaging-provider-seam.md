# 04 — `MessagingProvider` seam

Type: grilling
Status: open
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

_(ADR link + interface sketch)_
