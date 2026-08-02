# Onboarding state machine: eager identity provisioning, DO-held step, D1 completion marker

**Status:** accepted

## Context

First contact from an unrecognized channel identity (FR-ONB-01) must start onboarding,
not transaction parsing. But [ADR-0001](0001-per-user-durable-object-coordination-d1-ledger.md)
puts conversation context — including "the current onboarding step" — in a **per-user**
Durable Object, and a user doesn't exist yet at first contact. This ADR resolves that
chicken-and-egg, fixes the onboarding step order, the consent mechanism (NFR-SEC-08),
and how completion is recorded in the [ADR-0002](0002-double-entry-ledger-schema.md)
schema.

## Decision

### 1. Eager identity provisioning

A `users` row and its initial `channel_identities` row are created **at first contact**,
before consent — not deferred to onboarding completion. The per-user DO is keyed by
`user_id` from message one, exactly as ADR-0001 already models it, with no second DO
addressing scheme (e.g. keyed by `(channel, external_id)`) and no later DO-identity
migration once provisioning finishes. The channel-identity mapping itself is processed
under "necessary to operate the service the user just contacted," not under the
FR-ONB-02 consent basis — the consent gate (below) still blocks collection of
preferences and any financial data.

Rejected: keying the coordination DO by `(channel, external_id)` during onboarding and
only minting `user_id` (and migrating DO state) on completion. This avoids the
before-consent row but adds a second addressing scheme and a migration step, and
conflicts with ADR-0001's per-user DO model once multi-channel (FR-CH-05) needs one DO
to serve several channel identities.

### 2. Step order

`language → consent → display name → primary currency → timezone → confirm/edit
summary → provisioning`.

Language is asked **first**, via a language-neutral prompt (e.g. flag-labeled buttons),
so the consent notice and every subsequent prompt render in the user's chosen language
— including the legally-sensitive consent text itself. All four baseline-preference
fields (FR-ONB-03) are explicit questions; language is not inferred from channel
metadata.

### 3. Explicit affirmative consent

Advancing past the consent step requires an explicit affirmative action (an inline
button where the channel supports it, or an exact-match reply otherwise) — this is what
makes NFR-SEC-08's "explicit consent" concrete and auditable as a single timestamped
event. Any other reply re-prompts the same notice; the state machine does not advance on
ambiguous or unrelated input.

Rejected: implicit consent (treating any further message as consent) — cheaper on
friction but not defensibly "explicit" under NFR-SEC-08.

### 4. Default-offer pattern for currency and timezone

Fields with a spec default (currency → IDR, timezone → WIB) are asked as "here's the
default, reply to accept or give another value" rather than a bare open question. This
keeps the answer explicit and recorded (no silent-default step) while minimizing
friction for the Indonesian-majority user base who will accept the default outright.

### 5. Confirm/edit summary before provisioning

Once all four fields are collected, the bot shows a summary and asks for confirm/edit —
the same confirm/edit/discard pattern already used for transactions (PRD §4.2/§4.3).
Edit returns to the relevant step. This is the point at which the fields are still
correctable before they're written.

### 6. Completion marker: `users.onboarding_completed_at`

`users` gains a nullable `onboarding_completed_at INTEGER` (unix millis; NULL = still
onboarding). Provisioning sets it in the same write that seeds the default chart of
accounts (FR-ONB-04). This is the one piece of onboarding status that needs to be
queryable outside the DO (Admin Console / FR-ADM-08, and the message router's guard:
`NULL` → route to onboarding regardless of message content). The granular step itself
(which of the six steps above is current, and answers collected so far) stays in the
per-user DO's conversation context, per ADR-0001 — it is not duplicated into D1.

Rejected: inferring "onboarded" from the existence of `accounts` rows — works today but
encodes meaning implicitly in a table whose purpose is unrelated, and breaks if any
future flow ever creates `accounts` rows outside provisioning.

### 7. Resumability is same-channel only (EC-ONB-01, not EC-ONB-02)

On the next message from the **same** channel identity, the DO resumes at its stored
step (EC-ONB-01). Resuming an in-progress onboarding from a **different** channel
(EC-ONB-02) requires recognizing two channel identities as the same human, which is the
self-service linking flow (PRD §3.11) — still fog. Cross-channel resumption is out of
this ticket's reach until that flow exists; it is a scope boundary, not a decision made
here.

## Consequences

- Abandoned onboarding leaves a `users` row with `onboarding_completed_at IS NULL`
  forever (no accounts, no ledger data) — a data-retention/cleanup policy for these may
  be worth revisiting once UU PDP data-subject-rights work (NFR-SEC-08) is scoped, but
  no cleanup mechanism is decided here.
- The message router's entire "is this onboarding or a command/transaction" branch
  collapses to one check: `channel_identities` lookup, then
  `users.onboarding_completed_at IS NULL`.
- Traces: FR-ONB-01..05, EC-ONB-01, EC-ONB-02, NFR-SEC-08, FR-CH-05.
