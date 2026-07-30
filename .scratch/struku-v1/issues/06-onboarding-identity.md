# 06 — Onboarding & identity resolution

Type: grilling
Status: open
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

_(ADR link)_
