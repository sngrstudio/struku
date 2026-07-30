<!-- wayfinder:map -->
# Struku v1 — Foundations Map

## Destination

All foundational architecture + build-sequencing decisions for Struku v1 (per
[`docs/global-prd.md`](../../docs/global-prd.md) + [`docs/global-srs.md`](../../docs/global-srs.md))
resolved as ADRs, with tracer-bullet #1 specified sharply and ready to hand off
to `/to-spec`. **Planning only — no build happens inside this map.** When the fog
clears, this map hands off; it does not build.

## Notes

- **Domain:** chat-first personal-finance bot on Cloudflare Workers (Hono + D1 + R2
  + Workers AI). Source of truth for *what*: `docs/global-prd.md`, `docs/global-srs.md`.
- **Stack is fixed** (SRS §2.4) — Hono/Workers/D1/R2/Workers AI/pdf-lib/Xendit/
  Cloudflare Access are **not** decisions. The fog is *how* to use them, not *whether*.
- **Skills each session consults:** `/grilling` + `/domain-modeling` (default),
  `/prototype` (spikes), `/research` (external facts). Record decisions as ADRs under
  `docs/adr/` and add terms to `CONTEXT.md` via `/domain-modeling`.
- **Trace every decision back to SRS FR-IDs** in its ADR.
- **Tracer-bullet #1** (anchors ticket ordering): Telegram + free-text transaction +
  double-entry commit + confirm flow + onboarding. Telegram before WhatsApp (no Meta/
  api.co.id signup gating); free-text before image (no OCR-accuracy dependency). The
  `MessagingProvider` seam is built from the start even with one implementation.
- **Mode:** planning-by-default (no execution override).

## Decisions so far

<!-- index only — one line per resolved ticket, gist + link; detail lives in the ticket -->

- [07 · Workers AI structured-output capability](issues/07-workers-ai-structured-output.md) —
  JSON mode exists (`response_format`) but **not schema-guaranteed** → parse-validate-retry;
  best 3.x model `llama-3.3-70b-instruct-fp8-fast` (fn-calling+JSON, 24k ctx). **Open risks
  for #05:** latency undocumented (NFR-PERF-01 unproven) + Indonesian not officially supported
  — both need empirical validation in #05's spike.
- [02 · State & concurrency architecture](issues/02-state-concurrency-architecture.md) —
  per-user **Durable Object (SQLite backend)** as coordination actor (pending drafts +
  conversation context + `alarm()` timeouts + free write-serialization); **D1** stays the
  cross-user-queryable **ledger system-of-record**; messages route webhook→DO→D1.
  → [ADR-0001](../../docs/adr/0001-per-user-durable-object-coordination-d1-ledger.md).
  Surfaced follow-on #08 (Agents SDK vs raw DO); unblocks #03.

## Not yet specified

<!-- in-scope fog; graduates into tickets as the frontier advances past the spine -->

- WhatsApp / api.co.id provider + gateway evaluation & signup (2nd `MessagingProvider` impl)
- Image / receipt parsing + Indonesian OCR-accuracy validation (PRD §13 risk)
- Multi-currency conversion + Frankfurter daily cache (FR-CUR-03..05)
- Chat-native budget management (§3.5) & category management (§3.6)
- Transaction editing / reclassification resolution + audit-preserving reversal (§3.7)
- Reporting: PDF generation (pdf-lib) + in-chat delivery (§3.8)
- On-demand read-only detail web view + `detail_view_tokens` (§3.9)
- Self-service multi-channel linking, one-time code exchange (§3.11)
- Freemium limit enforcement (configurable) + Xendit billing (§3.13)
- Admin Console: channel config/validation + daily re-validation, user/data/subscription
  oversight, audit logging, Cloudflare Access gating (§3.14–§3.15)
- i18n resource layer + locale-aware formatting (PRD §9)
- Encryption-at-rest for sensitive fields + UU PDP data-subject rights (NFR-SEC-03, NFR-SEC-08)

## Out of scope

- PRD §5.2 candidate features (budgeting alerts, recurring-txn detection, voice-note
  parsing, split transactions, client/project tagging, anomaly alerts, referral program,
  accountant-ready export, shared/group ledgers) — already ruled out of v1 in SRS §1.2.
- General-purpose web dashboard; business/SME accounting; direct bank integration (SRS §1.2).
