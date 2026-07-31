<!-- wayfinder:map -->
# Struku v1 — Foundations Map

> **Status: destination tercapai (2026-08-01).** Semua 8 decision ticket resolved
> (ADR-0001..0006); tracer #1 (tiket 09–13) dibangun, dideploy, dan live di
> `@StrukuBot`. Effort lanjutannya:
> [Struku — Layak Dipakai Harian](../struku-daily/map.md), yang menggraduasikan
> sebagian fog di bawah ini. Fog yang tidak diambil map itu tetap tinggal di sini.

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
- [03 · Ledger schema design](issues/03-ledger-schema.md) — D1 double-entry core:
  **integer minor units** + `currencies.exponent` (balance integer-exact); `direction`
  enum; **single-currency per entry** (FX/rounding only on reporting path); `currency`
  on asset/liability accounts only; stable **account `slug`** + `is_default` as the
  join key; append-only `status`+`reverses_entry_id` (reserves FR-LDG-05); **UUIDv7 PKs
  + explicit `user_id` everywhere** for NFR-SEC-07.
  → [ADR-0002](../../docs/adr/0002-double-entry-ledger-schema.md). Unblocks #06.
- [06 · Onboarding & identity resolution](issues/06-onboarding-identity.md) — **eager**
  `users`/`channel_identities` creation at first contact (DO keyed by `user_id` from
  message one, no second addressing scheme); step order **language → consent
  (explicit affirmative action) → name → currency → timezone → confirm/edit →
  provisioning**; new nullable `users.onboarding_completed_at` gates the router while
  granular step stays DO-side; resumability is same-channel only, cross-channel
  deferred to the (still-fog) linking flow.
  → [ADR-0003](../../docs/adr/0003-onboarding-state-machine-eager-identity.md).
- [04 · `MessagingProvider` seam](issues/04-messaging-provider-seam.md) — added
  `sendChoicePrompt` beyond FR-CH-01's minimum for confirm/edit/discard-shaped
  interactions; button taps and typed replies normalize to the **same** `kind: 'text'`
  shape (EC-CH-03 true by construction, no provider-conditional branching); activation
  gate (FR-CH-04) sits at the **router**, before any `Provider` call; `Provider` is a
  **stateless payload translator** — raw `(channel, externalId)` only, identity
  resolution stays a router-layer concern above the seam. Interface sketch grounded
  against real Telegram Bot API JSON shapes.
  → [ADR-0004](../../docs/adr/0004-messaging-provider-seam.md). Unblocks #05.
- [05 · AI text-parsing contract](issues/05-ai-text-parsing-contract.md) (prototype) —
  live spike **proved both #07 risks away**: latency p50 ~1.7s / p95 ~2.4s (inside
  NFR-PERF-01) and Indonesian extraction accurate on `llama-3.3-70b-instruct-fp8-fast`.
  **Single flat call** routes `intent` + extracts (nested schema degrades → 14s spiral);
  amount stays **major-unit** (app converts to minor via ADR-0002 exponent); category is
  an **enum of canonical ADR-0002 slugs**; low-confidence → clarify not invent; defensive
  parse→Zod→1-retry. → [ADR-0005](../../docs/adr/0005-ai-text-parsing-contract.md).
  Surfaced fog: own-account transfers.
- [01 · Provision Telegram bot + webhook + secret](issues/01-provision-telegram-bot.md)
  (task) — live bot **`@StrukuBot`** stood up; real inbound `Update` fixtures captured
  via **getUpdates** (no webhook/secret/deploy — those defer to `/implement`) at
  [`fixtures/telegram-updates.json`](fixtures/telegram-updates.json). Validated ADR-0004
  against real payloads (shape holds; `date` is unix **seconds** → provider ×1000 for
  millis). Pinned secret-binding convention **`TELEGRAM_BOT_TOKEN`**. Feeds the #05
  parsing spike.
- [08 · Coordination actor: Agents SDK vs raw Durable Object](issues/08-agents-sdk-vs-raw-durable-object.md)
  (grilling) — build the per-user actor on the **Cloudflare Agents SDK** (`Agent`
  subclass, `getAgentByName(user_id)`). Deciding factor: SDK **multiplexes many schedules
  over the DO's single `alarm()`** (EC-IMG-05's timeout need, free vs hand-rolled);
  first-party over the DO+SQLite substrate ADR-0001 already chose. Guardrail: sits
  **behind** the MessagingProvider seam, consumes only the ADR-0004 normalized message —
  no SDK/channel shapes in core logic; AI parsing + D1 commit stay app-layer.
  → [ADR-0006](../../docs/adr/0006-coordination-actor-on-agents-sdk.md).

## Not yet specified

<!-- in-scope fog; graduates into tickets as the frontier advances past the spine -->

- WhatsApp / api.co.id provider + gateway evaluation & signup (2nd `MessagingProvider` impl)
- Image / receipt parsing + Indonesian OCR-accuracy validation (PRD §13 risk)
- Own-account **transfers** (asset→asset): a third transaction shape beyond income/expense
  — the parsing contract (ADR-0005) leaves these to a future ticket (resolves two asset
  accounts by slug, not a category)
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
