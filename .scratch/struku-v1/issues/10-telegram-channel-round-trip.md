# 10 — Telegram channel round-trip: provider, webhook, activation gate

**What to build:** A message sent to the webhook is normalized and the bot replies — proving
the channel-agnostic `MessagingProvider` seam and outbound rendering work end to end on
Telegram, before any user or ledger logic exists. The reply is a temporary echo stand-in that
slices 11–13 replace with real handling.

Grounded in [spec.md](../spec.md) and ADR-0004 (+ #01 fixtures).

**Blocked by:** 09.

**Status:** ready-for-agent

- [ ] `POST` of a raw Telegram `Update` to the webhook route returns `200` and, when the channel is active, produces an outbound Telegram reply (echo stand-in).
- [ ] `TelegramProvider.receiveInboundMessage` normalizes the real captured fixtures (`fixtures/telegram-updates.json`): a plain-text `Update` and a reply-to-message `Update` → `NormalizedInboundMessage` with `chat.id` as `externalId`, `date × 1000` as millis `timestamp`, `replyToId`, and `kind: 'text'`.
- [ ] A Telegram `callback_query` tap normalizes to `{ kind: 'text', text: option.id }` — structurally identical to a typed reply (EC-CH-03).
- [ ] Outbound `sendText` and `sendChoicePrompt` render to Bot API calls (choice prompt as an inline keyboard with `callback_data = option.id`); outbound HTTP is faked in tests and asserted on.
- [ ] The activation gate ignores/rejects an inbound update on an inactive/unvalidated channel **before** any provider parsing runs (EC-CH-01), at exactly one checkpoint in the router.
- [ ] A malformed/unparseable update is logged and swallowed; the handler still returns `200` and does not crash the shared interface (EC-CH-02).
- [ ] `TelegramProvider` is a stateless translator: no D1 access, no `user_id` resolution (identity resolution stays a router concern, above the seam).
