# `MessagingProvider` seam: choice-prompt method, uniform tap/text normalization, router-owned identity resolution

**Status:** accepted

## Context

FR-CH-01..03 require a channel-agnostic `MessagingProvider` interface so core bot logic
never touches a provider-native payload shape, with EC-CH-03 specifically requiring that
provider-specific interactive affordances (Telegram inline keyboards, WhatsApp buttons)
stay optional enhancements, never a required dependency of core flows like confirm/edit/
discard (PRD §4.2/§4.3) or the onboarding confirm summary
([ADR-0003](0003-onboarding-state-machine-eager-identity.md)). FR-CH-04/EC-CH-01 require
gating live routing on `channel_configs` validation state. This ADR fixes the interface
surface, the normalized inbound message shape, where the activation gate sits, and where
identity resolution happens — for `TelegramProvider` as the first implementation;
`WhatsAppProvider` stays fog (only the interface it must satisfy is fixed here).

Grounded against the real Telegram Bot API `Update`/`Message`/`User`/`Chat` JSON shapes
(core.telegram.org/bots/api) — `chat.id` is the stable per-conversation identity,
`from.language_code` carries the client's language hint, `reply_to_message` nests the
full replied-to `Message`, `photo`/`document` carry Telegram `file_id`s (not bytes).
Ticket #01 (provisioning the live bot) hadn't captured real fixtures at the time of this
decision — this sketch should be checked against those once captured, but the shape is
unlikely to move: it's read directly off Telegram's documented schema.

**Update — fixtures captured (#01 resolved):** real `@StrukuBot` `getUpdates` payloads
(`.scratch/struku-v1/fixtures/telegram-updates.json`) confirm the shape — `chat.id` as
identity (equal to `from.id` in private chats), `reply_to_message` nesting a full
`Message`, `from.language_code` present. One normalization detail surfaced: Telegram
`date` is unix **seconds**, so `TelegramProvider` multiplies by 1000 to produce the
envelope's millis `timestamp`.

## Decision

### 1. Explicit `sendChoicePrompt`, beyond FR-CH-01's minimum

`sendChoicePrompt(to, text, options: {id, label}[])` is added to the interface
alongside FR-CH-01's five minimum methods. Each provider renders it however fits — an
inline keyboard with `callback_data = option.id` for Telegram, a numbered list in plain
text for a provider without native buttons. Naming the intent explicitly (rather than
folding it into `sendText` as an optional param) keeps call sites unambiguous about what
kind of reply they're waiting for, and makes every confirm/edit/discard-shaped
interaction grep-able by this one method name.

Rejected: an optional `choices` param on `sendText` — smaller interface surface, but
conflates "send a message" with "send a message that expects a specific-shaped reply."

### 2. Button taps normalize to the same `kind: 'text'` as typed replies

A Telegram `callback_query` tap is normalized to
`{ kind: 'text', text: <option.id>, ... }` — structurally identical to a typed reply.
Business logic that's waiting on a `sendChoicePrompt` answer checks exactly one shape,
never branching on whether the user tapped or typed. This makes EC-CH-03's invariant
true *by construction*: there is no code path that only works when native buttons exist.
Free-text synonym matching ("ya"/"oke"/"👍" all meaning "confirm") is a business-logic
concern above the seam, not this ticket's problem — the seam's job stops at delivering
`text`.

Rejected: a separate `kind: 'choice'` with its own `choiceId` field — more explicit
about a reply's origin, but forces every choice-prompt consumer to check two shapes
(`choiceId` match OR `text` match), which is exactly the kind of provider-affordance
leakage EC-CH-03 warns against.

### 3. Activation gate lives at the router, before any `Provider` call

The webhook handler checks `channel_configs` validation/active state **before** calling
`provider.receiveInboundMessage()` at all. An inactive/unvalidated channel is
rejected/ignored (EC-CH-01) without any provider-specific parsing running. `Provider`
implementations carry zero activation-policy logic — per FR-CH-02 their only job is
translating payload shapes. This keeps FR-CH-04 enforcement at exactly one reviewable
checkpoint instead of duplicated (and potentially forgotten) inside every provider.

### 4. `Provider` is a stateless payload translator; identity resolution is a router concern

`receiveInboundMessage` returns raw `(channel, externalId)` — Telegram's `chat.id`
stringified, WhatsApp's phone number — never a resolved `user_id`. Looking up
`channel_identities` and minting/resolving the `user_id` (the eager-provisioning flow
from ADR-0003) happens in the router, one layer above `Provider`. This keeps FR-CH-02's
"solely translating" scope honest — a `Provider` needs no D1 access and no knowledge of
the `users`/`channel_identities` schema, so `WhatsAppProvider` can be built later without
re-deriving identity-resolution logic that already exists once, in the router.

## Interface sketch

```ts
type Channel = 'telegram' | 'whatsapp';

interface ChoiceOption {
  id: string;     // stable, e.g. 'confirm' | 'edit' | 'discard'
  label: string;  // display text
}

interface MessagingProvider {
  sendText(to: string, text: string): Promise<void>;
  sendMediaPrompt(to: string, text: string): Promise<void>;
  sendChoicePrompt(to: string, text: string, options: ChoiceOption[]): Promise<void>;
  sendDocument(
    to: string,
    file: { bytes: ArrayBuffer; filename: string; mimeType: string },
    caption?: string,
  ): Promise<void>;
  sendLinkRequestCode(to: string, code: string): Promise<void>; // signature reserved; flow is §3.11 fog
  receiveInboundMessage(rawPayload: unknown): NormalizedInboundMessage | InboundParseFailure;
}

interface InboundEnvelope {
  channel: Channel;
  externalId: string;        // chat.id (Telegram) / phone number (WhatsApp) — raw, unresolved
  senderDisplayName?: string; // hint only (e.g. Telegram first_name), never authoritative
  messageId: string;          // this message's own id, stringified
  replyToId: string | null;   // stringified id of the message being replied to, if any
  timestamp: number;          // unix millis
}

type NormalizedInboundMessage = InboundEnvelope & (
  | { kind: 'text'; text: string }
  | { kind: 'image'; fileRef: string; caption?: string }
  | { kind: 'document'; fileRef: string; filename?: string }
);

interface InboundParseFailure {
  channel: Channel;
  reason: string; // logged per EC-CH-02; router logs + 200s, never crashes the shared interface
}
```

`fileRef` is an opaque, provider-internal handle (Telegram's `file_id`) — not bytes and
not a URL. How it gets resolved to actual bytes (Telegram's two-step `getFile` +
download) is deliberately undecided here: that belongs to the still-fog image-parsing
ticket. `sendLinkRequestCode`'s signature is reserved per FR-CH-01's minimum list, but
the linking flow it serves (§3.11) is unspecified fog — same reservation pattern as
ADR-0002's append-only lifecycle reserving reversal capacity without choosing the
correction flow.

## Scope boundary

`WhatsAppProvider` is not designed here — only that it must satisfy the
`MessagingProvider` interface above. `channel_configs` schema, the daily re-validation
cycle (§3.14), and image `fileRef` resolution remain in the map's fog.

## Consequences

- Every confirm/edit/discard-shaped flow (transaction confirm, onboarding summary,
  future editing §3.7) is written once against `sendChoicePrompt` +
  `NormalizedInboundMessage.kind === 'text'`, with no provider-conditional branches.
- `Provider` implementations need no D1 binding — easier to unit-test in isolation from
  the per-user DO and the ledger schema.
- Traces: FR-CH-01..05, EC-CH-01..03, PRD §7.1, PRD §13 risk.
