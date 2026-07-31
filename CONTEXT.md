# Struku

Glossary for Struku — an AI-powered, chat-first personal-finance bot. Terms here are
the canonical vocabulary; prefer them over the synonyms listed under _Avoid_.

## Language

**Pending draft**:
A parsed-but-uncommitted transaction awaiting the user's confirm / edit / discard
reply. It is not yet part of the ledger and expires on timeout.
_Avoid_: pending transaction, temp entry, unconfirmed transaction

**Conversation context**:
The per-user, in-flight state carried across messages — the current onboarding step,
an outstanding clarification question, or which pending draft is awaiting confirmation.
_Avoid_: session, chat state

**Journal entry**:
A committed double-entry transaction in the D1 ledger — a header (date, description,
source, single entry-level currency, status) plus two or more balanced journal lines.
Reaches D1 only after confirmation; append-only once posted.
_Avoid_: transaction record, ledger row

**Journal line**:
One debit or credit within a journal entry — an `account_id`, a `direction`
(debit/credit), a positive `amount_minor`, and its own currency. Every line of an entry
shares the entry's currency in v1.
_Avoid_: ledger line item, posting leg

**Minor units**:
The integer representation of a money amount in a currency's smallest unit, scaled by
that currency's exponent (IDR exponent 0 → `1500` = Rp 1.500; USD exponent 2 →
`1234` = $12.34). All stored amounts are minor units; balance checks are integer-exact.
_Avoid_: cents, smallest denomination

**Account slug**:
A stable canonical key on an account, unique per user, that survives display renames and
anchors all system references — AI parsing, category mapping, onboarding — via
`(user_id, slug)`. Default accounts carry well-known slugs (`expense_food`, `bank`, …).
_Avoid_: account code, account key

**Primary reporting currency**:
The single currency each user picks at onboarding (default IDR) into which aggregated
views convert non-primary amounts using the daily-cached rate. Individual entries may be
recorded in any currency; only aggregation converts.
_Avoid_: base currency, home currency, default currency

**Onboarding**:
The first-contact flow that provisions a new account: language, explicit consent, then
baseline preferences (display name, primary reporting currency, timezone), ending in
provisioning. A `users` row exists for the whole flow (minted eagerly at first contact);
`onboarding_completed_at IS NULL` marks it still in progress.
_Avoid_: signup, registration

**Provisioning**:
The terminal step of onboarding: seeding the default chart of accounts and setting
`users.onboarding_completed_at`. One step within onboarding, not the whole flow.
_Avoid_: account creation, account setup

**Normalized inbound message**:
A provider-translated inbound message — `text` | `image` | `document` — carrying raw
`(channel, externalId)` identity, its own `messageId`, and an optional `replyToId`.
Never carries a resolved `user_id`; identity resolution happens above the
`MessagingProvider` seam, not inside it.
_Avoid_: webhook payload, update object

**Choice prompt**:
A message that asks the user to pick one of a fixed set of options (confirm/edit/
discard, and similar). Rendered as native buttons where a channel supports them,
plain numbered text otherwise — the reply is normalized identically either way, so
core flow logic never branches on which affordance was used.
_Avoid_: button prompt, inline keyboard, quick reply

**Reversing entry**:
A journal entry that cancels a previously posted one by mirroring its lines, linked via
`reverses_entry_id`; the original is marked `reversed`. The append-only mechanism that
keeps ledger balance intact through corrections without mutating history.
_Avoid_: void, rollback entry
