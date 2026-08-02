# 06 — Onboarding & identity resolution

Type: grilling
Status: resolved
Blocked by: 03

## Question

Design first-contact → provisioned account. Blocked by #03 (needs `users` /
`channel_identities` schema).

Pin down:

- **First-contact detection**: an inbound message from an unrecognized channel identity
  starts onboarding rather than being parsed as a transaction/command (FR-ONB-01).
- **Consent gate**: welcome + link to consent/ToS notice **before** collecting data
  (FR-ONB-02) — the UU PDP explicit-consent hinge (NFR-SEC-08).
- **Baseline preferences** collected: display name, primary reporting currency (default
  IDR), timezone (default WIB), language (FR-ONB-03).
- **Provisioning**: create `users` + initial `channel_identities` + seed default chart
  of accounts (FR-ONB-04), account on Free tier.
- **Resumability**: partial-onboarding state survives abandonment and resumes from the
  last step (EC-ONB-01) — ties into the conversational-state decision from #02.
- **Isolation invariant**: every downstream query scoped by `user_id` (FR-ONB-05,
  NFR-SEC-07).

Deliverable: ADR describing the onboarding state machine + identity model.

## Answer

→ [ADR-0003](../../../docs/adr/0003-onboarding-state-machine-eager-identity.md)

- **Eager identity provisioning**: `users` + `channel_identities` rows created at first
  contact, before consent; per-user DO keyed by `user_id` from message one (no second
  DO addressing scheme, no later migration).
- **Step order**: language (button-based, no language needed to answer) → consent
  (explicit affirmative action required, rendered in chosen language) → display name →
  primary currency (default-offer pattern) → timezone (default-offer pattern) →
  confirm/edit summary (mirrors transaction confirm/edit/discard) → provisioning (seed
  default chart of accounts + set completion marker).
- **Completion marker**: `users.onboarding_completed_at` (nullable, unix millis) added
  to the ADR-0002 schema — NULL gates the message router to onboarding regardless of
  content; granular step stays in the DO's conversation context (ADR-0001), not
  duplicated into D1.
- **Resumability**: same-channel only (EC-ONB-01). Cross-channel resumption
  (EC-ONB-02) is a scope boundary — deferred to the self-service linking flow (§3.11,
  still fog), not decided here.
