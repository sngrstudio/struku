# 11 — Onboarding: eager identity, state machine, provisioning

**What to build:** A brand-new Telegram user is recognized on first contact, walked through
onboarding in their own language, and left with a provisioned Free-tier account and a default
chart of accounts. This slice introduces the per-user coordination Agent and its conversation
context.

Grounded in [spec.md](../spec.md) and ADR-0001/0003/0006.

**Blocked by:** 09, 10.

**Status:** ready-for-agent

- [ ] First contact from an unrecognized `(channel, external_id)` eagerly mints a `users` row + `channel_identities` row and routes to the per-user Agent (`getAgentByName(user_id)`); the message is treated as onboarding, not a transaction (FR-ONB-01). Identity resolution happens in the router, above the provider seam.
- [ ] The router's onboarding guard routes to onboarding whenever `users.onboarding_completed_at IS NULL`, regardless of message content.
- [ ] The state machine runs `language → consent → display name → primary currency → timezone → confirm/edit summary → provisioning`. Language is asked **first** via a language-neutral prompt, so consent and every later prompt render in the chosen language.
- [ ] Consent requires an explicit affirmative action (inline button or exact-match reply); ambiguous/unrelated replies re-prompt and do **not** advance (NFR-SEC-08).
- [ ] Currency and timezone use the default-offer pattern (accept IDR / WIB with one action, or override); `Edit` at the summary returns to the chosen step.
- [ ] Provisioning seeds the default chart of accounts (from the slice-09 seed definition) and sets `onboarding_completed_at` in the same write; the account is on the Free tier.
- [ ] The granular onboarding step + collected answers live in the Agent's conversation context (`this.sql`), not duplicated into D1; abandoning and messaging again from the **same** chat resumes at the stored step (EC-ONB-01).
- [ ] Verified through the webhook seam: a full onboarding transcript yields the expected `users` row (with `onboarding_completed_at` set) and seeded chart of accounts; a resume scenario picks up mid-flow rather than restarting.
- [ ] User-facing copy carries no accounting jargon (NFR-USE-02).
