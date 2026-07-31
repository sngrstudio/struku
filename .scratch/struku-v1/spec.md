# Spec: Tracer-bullet #1 — Telegram free-text transaction, end-to-end

Status: ready-for-agent

<!--
The first vertical slice of Struku v1: a real Telegram user can message @StrukuBot,
get onboarded, type a transaction in natural language, confirm it, and have a balanced
double-entry journal entry committed to D1. Every foundational architecture decision this
slice needs is already resolved as an ADR (0001–0006); this spec composes them into one
buildable, testable feature. Trace IDs point back to docs/global-srs.md.
-->

## Problem Statement

A person wants to keep track of what they spend and earn, but every finance app makes them
stop, open a dedicated tool, and type structured data into forms — so within a few weeks
they give up. They already have Telegram open all day. They want to record "I bought coffee
for 25k" by just typing that sentence to a bot, the way they'd tell a friend, and trust that
it's been recorded correctly — without learning what "debit," "credit," or a "chart of
accounts" is.

## Solution

A person messages **@StrukuBot** on Telegram. On first contact the bot walks them through a
short **onboarding** — language, an explicit consent step, then display name, primary
reporting currency (default IDR), and timezone (default WIB) — and provisions their account
with a default chart of accounts. From then on they can type a natural-language transaction
like *"kopi 25rb"* or *"gaji masuk 5jt"*. The bot parses it with AI, shows a plain-language
summary (*"Pengeluaran Rp 25.000 — Makan. Betul?"*) with **Confirm / Edit / Discard**
buttons, and only on confirm commits a balanced **journal entry** to the ledger. If an
essential field is missing (e.g. no amount), the bot asks a **clarification** question in the
user's language instead of guessing. Under the hood every entry is proper double-entry
bookkeeping, but the user never sees that vocabulary.

This is the first tracer bullet: one channel (Telegram), one input mode (free text), one
fully-built intent (transaction). It proves the whole spine — webhook → identity → onboarding
→ AI parse → pending draft → confirm → double-entry commit — works end to end.

## User Stories

### Onboarding & identity (FR-ONB-01..05, EC-ONB-01, NFR-SEC-08)

1. As a first-time user, I want the bot to recognize that I've never messaged it before and start onboarding, so that it doesn't try to parse my first "hi" as a transaction.
2. As a first-time user, I want to be asked my language first via a language-neutral prompt (flag-labelled buttons), so that every subsequent message — including the consent notice — is in a language I read.
3. As a first-time user, I want to be shown a clear consent / Terms notice and have to take an explicit affirmative action to proceed, so that I know what data is collected and why before any of it is processed.
4. As a privacy-conscious user, I want the bot to NOT advance past consent on an ambiguous or unrelated reply, so that consent is a deliberate act and not something I trip into.
5. As a new user, I want to be asked my display name, so that the bot can address me.
6. As an Indonesian user, I want the currency step to offer IDR as the default I can accept with one tap, so that I don't have to type it out.
7. As a new user, I want the timezone step to offer WIB as the default I can accept or override, so that my transaction dates land on the right day.
8. As a new user, I want a summary of my four answers with a Confirm / Edit option before anything is provisioned, so that I can fix a mistake before it's written.
9. As a new user who picks Edit at the summary, I want to be returned to the specific step I want to change, so that I don't have to redo the whole flow.
10. As a new user, I want my account and default chart of accounts provisioned automatically on the Free tier when onboarding completes, so that I can start recording immediately.
11. As a user who walked away mid-onboarding, I want the bot to resume from the step I left off on my next message from the same Telegram chat, so that I don't start over.
12. As a returning, fully-onboarded user, I want my messages to skip onboarding entirely and go straight to transaction handling, so that recording stays fast.

### Recording a transaction via free text (FR-TXT-01..04, EC-TXT-01..03)

13. As a user, I want to type "bought coffee 25k" and have the bot understand it's an expense of Rp 25.000 in the Food category, so that recording is as easy as texting.
14. As an Indonesian-speaking user, I want shorthand like "25rb", "25k", "5jt", "1.5jt" resolved to absolute amounts (25000, 5000000, 1500000), so that I can write the way I normally do.
15. As a user, I want the resolved absolute amount shown back to me at confirmation ("Rp 25.000", not "25k"), so that I can catch a misread before it's committed.
16. As a user, I want income like "gaji masuk 5jt" recognized as income into my Salary account, so that both directions of cash flow are captured.
17. As a user, I want a transaction I recorded in a foreign currency ("bayar netflix 15 usd") kept in that currency, so that my records reflect what actually happened.
18. As a user, I want the transaction date to default to today in my timezone when I don't state one, so that I don't have to type the date for same-day entries.
19. As a user whose message is missing an essential field (e.g. "jajan bakso tadi siang" with no amount), I want the bot to ask me a short clarifying question in my language rather than invent a number, so that my ledger is never silently wrong.
20. As a user, I want the bot to never fabricate an amount I didn't state, so that I can trust every figure in my ledger.
21. As a user who sends a second transaction while a previous draft is still pending, I want the new message treated as a new draft rather than silently overwriting the old one, so that I don't lose a transaction.

### Confirm / edit / discard (FR-TXT-03, FR-IMG-04..08 pattern, EC-CH-03)

22. As a user, I want a Confirm / Edit / Discard choice after every parse, so that nothing reaches my ledger without my say-so.
23. As a user on Telegram, I want those choices as tappable buttons, so that confirming is one tap.
24. As a user, I want to be able to type "ya"/"confirm" instead of tapping and have it work identically, so that I'm not forced to use buttons.
25. As a user who taps Confirm, I want a balanced journal entry committed and a short acknowledgement, so that I know it's saved.
26. As a user who taps Discard, I want the draft thrown away with no ledger entry created, so that a mistaken message leaves no trace.
27. As a user who taps Edit, I want to correct the parsed fields before commit (tracer #1: amount/category/date/direction), so that a small misparse doesn't force me to retype the whole thing.
28. As a user, I want a pending draft that I never answer to quietly expire after a timeout, so that a stale confirmation doesn't hang around forever or commit by accident.
29. As a user whose draft expired, I want to be able to just send the transaction again, so that recovering from a timeout is trivial.

### Ledger integrity (FR-LDG-01..04, EC-LDG-02, NFR-SEC-07)

30. As a user, I want every confirmed transaction stored as a balanced double-entry journal entry, so that my books are accurate and auditable even though I never see the accounting.
31. As a user, I want amounts stored exactly (no floating-point drift), so that my balances are always correct to the smallest unit.
32. As a user, I want the correct pair of accounts chosen automatically (e.g. expense → Food debited, Cash credited), so that I don't have to think in accounts.
33. As a user firing off two confirmations at nearly the same time, I want both correctly posted with none lost or duplicated, so that rapid entry is safe.
34. As any user, I want it to be structurally impossible for my data to leak into or from another user's ledger, so that my finances stay private.

### Intent routing for non-transaction messages (FR-TXT-04, ADR-0005 scope)

35. As a user, I want a budget/category/query message ("set budget makan 500rb", "berapa pengeluaran bulan ini?") recognized as NOT a transaction, so that it isn't recorded as a spend.
36. As a user, I want a not-yet-built intent to get a graceful "belum bisa" style reply rather than an error or a wrong journal entry, so that the bot feels honest about its limits.
37. As a user whose message can't be understood at all, I want a friendly ask-to-rephrase rather than a crash or a guess, so that I know what to do next.

### Reliability & responsiveness (NFR-PERF-01, EC-CH-02)

38. As a user, I want a reply within a few seconds of sending a transaction, so that it feels like a conversation.
39. As the operator, I want a malformed or unparseable inbound update logged and swallowed (webhook still 200s) rather than crashing the handler, so that one bad message can't take the bot down.
40. As the operator, I want inbound traffic on an inactive/unvalidated Telegram channel ignored before any parsing runs, so that the activation gate is enforced at exactly one checkpoint.

## Implementation Decisions

Every decision below is the composition of an already-accepted ADR into this slice. Where an
ADR fixed the detail, this spec points to it rather than re-deciding.

### Modules & seams

- **Webhook router (Worker, Hono).** The single ingress: `POST` endpoint receiving Telegram
  `Update` payloads. Responsibilities, in order: (1) enforce the **activation gate** — reject/
  ignore if the channel is not validated/active, *before* any provider parsing (ADR-0004 §3,
  FR-CH-04/EC-CH-01); (2) call the provider to normalize; (3) resolve identity — look up
  `channel_identities` by `(channel, external_id)`, **eagerly minting** a `users` +
  `channel_identities` row on first contact (ADR-0003 §1); (4) route to the user's coordination
  actor by `user_id`; (5) always return `200` even on parse failure, logging and swallowing
  (EC-CH-02). Identity resolution lives here, above the provider seam — the provider never sees
  a `user_id` (ADR-0004 §4).
- **`MessagingProvider` seam + `TelegramProvider`.** Interface per ADR-0004's sketch:
  `sendText`, `sendMediaPrompt`, `sendChoicePrompt`, `sendDocument`, `sendLinkRequestCode`
  (signature reserved, unused in tracer #1), `receiveInboundMessage`. `TelegramProvider` is a
  **stateless payload translator**: raw `Update` → `NormalizedInboundMessage` (or
  `InboundParseFailure`), and normalized outbound → Telegram Bot API calls. It renders
  `sendChoicePrompt` as an inline keyboard with `callback_data = option.id`; a `callback_query`
  tap normalizes back to `{ kind: 'text', text: option.id }` — **structurally identical to a
  typed reply** (ADR-0004 §2, EC-CH-03). Telegram `date` (unix **seconds**) is ×1000 to millis
  (#01 fixtures). No D1 access, no channel-config logic inside the provider.
- **Coordination actor (Agents SDK `Agent` subclass), one per user.** Addressed
  `getAgentByName(user_id)` (ADR-0006). Holds **conversation context** (current onboarding step
  + collected answers, or the outstanding clarification) and the **pending draft** in
  `this.sql` structured tables — not in `state` (no connected clients; ingress is webhook, not
  WebSocket). Uses `this.schedule(...)` for the pending-draft **timeout**, which multiplexes
  over the single DO `alarm()` (ADR-0006 deciding factor; EC-IMG-05 pattern applied to the text
  draft). It consumes only the **`NormalizedInboundMessage`** (never a Telegram/SDK shape) and
  drives: onboarding SM → AI parse → draft → confirm → D1 commit. AI parsing and the D1 commit
  stay app-layer, invoked from the actor, not delegated to any SDK opinion.
- **`TextParser` port + Workers-AI implementation.** A single injectable seam the actor calls:
  normalized text (+ locale) → validated `ParseResult`. The real implementation is the ADR-0005
  contract: one **flat** `env.AI.run` call on `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, JSON
  mode (`response_format: json_schema`, `max_tokens ≥ 512`), then **parse → Zod-validate → one
  retry → ask-to-rephrase**. This port is the injection point for deterministic tests (see
  Testing Decisions).
- **Ledger writer (app-layer, D1).** Given a confirmed draft, resolves the account pair by
  **`(user_id, slug)`**, converts the AI's **major-unit** amount to **minor units** via
  `currencies.exponent` (ADR-0005 §4, ADR-0002 §1), runs the **app-layer balance check**
  (≥2 lines, all lines share the entry currency, `SUM(debit) == SUM(credit)`, integer-exact)
  **before** any write, and commits a `journal_entries` + `journal_lines` set. Concurrency is
  serialized by the per-user actor (EC-LDG-02) — no D1 lock table.

### D1 schema

- Apply the **ADR-0002 ledger core** as the first migration: `currencies`, `users`,
  `channel_identities`, `accounts`, `journal_entries`, `journal_lines`, exactly as the ADR-0002
  DDL sketch fixes them (integer `amount_minor`, `direction` enum, single-currency-per-entry
  denormalized onto `journal_entries.currency`, currency NOT NULL on asset/liability accounts
  only, slug-anchored accounts, append-only `status` + `reverses_entry_id`, text UUIDv7 PKs,
  explicit `user_id` on every user-scoped table including `journal_lines`).
- Add **`users.onboarding_completed_at INTEGER` (nullable)** per ADR-0003 §6 — the one piece of
  onboarding status queryable outside the actor; the router's onboarding guard is exactly
  `channel_identities` lookup → `onboarding_completed_at IS NULL` → route to onboarding.
- Seed `currencies` with at least IDR (exp 0) and USD (exp 2). Seed the **default chart of
  accounts** from ADR-0002's canonical slug→type→name→currency table at provisioning.
- Tables outside the ledger core (`attachments`, `categories`, `budgets`, `exchange_rates`,
  `channel_configs`, …) are **not** created in this slice; they stay in the map's fog. The
  activation gate reads channel-active state, but a full `channel_configs` schema + Admin
  Console validation cycle is out of scope — tracer #1 may treat the single Telegram channel as
  active via configuration/secret presence rather than a validated DB row (see Out of Scope).

### AI parse contract (ADR-0005)

Flat `ParseResult`, `intent` required, everything else nullable. This is the shape the
`TextParser` port returns and the confirm flow consumes (encodes the decision precisely):

```ts
// Validated with Zod against this contract; see ADR-0005 §3/§7.
interface ParseResult {
  intent: 'transaction' | 'budget' | 'category' | 'query' | 'unknown';
  txn_type: 'income' | 'expense' | null;
  amount: number | null;      // MAJOR/absolute units; app converts to minor via exponent
  currency: string;           // ISO-4217, default 'IDR'
  category: string | null;    // enum of canonical ADR-0002 slugs (expense_food, income_salary, …)
  date: string | null;        // 'YYYY-MM-DD'; null → app fills today-in-user-timezone
  clarification: string | null; // set (in user's language) when an essential field is missing
}
```

- **Only the `transaction` path is fully built.** `budget` / `category` / `query` are
  **routed** (classified) but their handlers reply with a graceful stub. `unknown` → ask to
  rephrase.
- **Amount unit boundary:** model emits major units + currency; the **app** converts to minor.
  The LLM never touches per-currency exponents (ADR-0005 §4).
- **Category** is constrained by JSON schema to canonical slugs → deterministic `(user_id,
  slug)` mapping, no fuzzy post-match (ADR-0005 §5).
- **Clarification, not invention:** missing essential field → `amount: null` + a question in
  the user's language; never fabricate (ADR-0005 §6; EC-TXT-01/02).
- **Prompt is locale-parameterized** (`${LOCALE}` placeholder); schema keys/instructions stay
  English, values may be Indonesian (ADR-0005 §8, PRD §9). No hardcoded `id`.
- **Own-account transfers** (asset→asset) don't fit the income/expense binary → out of tracer
  #1; such a message may resolve to `unknown`/clarify (ADR-0005 consequences).

### Pending-draft / confirm state (per-user actor)

- After a `transaction`-intent parse with all essential fields present, the actor stores a
  **pending draft** (with its DO-minted UUIDv7 entry id, ADR-0002 §7) and sends a
  `sendChoicePrompt` with options `confirm` / `edit` / `discard`.
- The reply is matched on the normalized `text` (button id or typed synonym; free-text synonym
  matching like "ya"/"oke"/"👍" is business logic above the seam, ADR-0004 §2).
- `confirm` → ledger writer commits, draft cleared, timeout cancelled, acknowledgement sent.
- `discard` → draft cleared, timeout cancelled, no D1 write.
- `edit` → re-open the relevant field(s) for correction, then re-summarize (tracer #1 keeps
  edit minimal: correct amount/category/date/direction on the *pending* draft, not post-commit
  editing which is §3.7 fog).
- **Timeout:** a scheduled expiry (configurable; **propose 30 minutes** — pin during
  implementation, SRS leaves it "a defined timeout") clears the pending draft and MAY notify
  (EC-IMG-05). A new transaction message while a draft is pending starts a **new** draft rather
  than overwriting (EC-TXT-03).

### Traceability

Onboarding FR-ONB-01..05 / EC-ONB-01 / NFR-SEC-08; free-text FR-TXT-01..04 / EC-TXT-01..03;
ledger FR-LDG-01..04 / EC-LDG-02; channel FR-CH-01..05 / EC-CH-01..03; NFR-PERF-01;
NFR-SEC-07. Builds on ADR-0001..0006.

## Testing Decisions

### What makes a good test here

Tests assert **external, observable behavior**, never internal structure. For this slice the
observable behavior at the primary seam is: **(a) what the bot sends back** (which outbound
`MessagingProvider` calls, with what user-facing content) and **(b) what ends up in the D1
ledger** (journal entries and balanced lines, or the absence of them). A test should read like
a transcript of a real conversation plus an assertion on the resulting books — not like an
inspection of the actor's private SQL rows or the onboarding enum's current value. No test
asserts on DO-internal state directly; it drives messages in and observes messages + ledger
out.

### Primary seam — webhook HTTP boundary (confirmed with owner)

The gating behavioral tests drive the whole tracer through its **highest** seam: `POST` a raw
Telegram `Update` JSON to the webhook route and assert on the two observable outputs. This
exercises router → activation gate → identity resolution → `TelegramProvider` normalization →
per-user actor → onboarding SM / draft / confirm → ledger commit, all wired together.

- **Real** in these tests: the Hono router, the DO/Agent (Agents SDK), and D1 — all running in
  **`vitest-pool-workers`** (Cloudflare's Workers test pool, with real D1 + DO bindings and
  `runDurableObjectAlarm`-style control for exercising the timeout).
- **Faked** (the two non-deterministic externals, injected as seams):
  1. **`TextParser` port** — a fake returning canned `ParseResult`s (deterministic, no neuron
     cost). This is the injection the owner chose over running live Workers AI in the gate.
     Canned results cover: a clean expense, a clean income, a foreign-currency expense, the
     missing-amount → clarification case, and a non-transaction intent.
  2. **Outbound Telegram HTTP** — a `fetch` interceptor that captures outbound Bot API calls so
     the test can assert what the bot sent (text / choice-prompt options) without hitting
     Telegram.

Representative gating scenarios (each a POST-driven transcript + ledger assertion):

- First contact from an unknown chat → onboarding starts (not a parse); walk language →
  consent → name → currency → timezone → summary → confirm → provisioning; assert a `users`
  row with `onboarding_completed_at` set and the default chart of accounts seeded.
- Onboarding abandoned then resumed from the same chat → picks up at the stored step
  (EC-ONB-01).
- Onboarded user sends "kopi 25rb" → choice prompt shows "Rp 25.000 / Makan / expense"; tap
  `confirm` → exactly one `journal_entries` with balanced `journal_lines`
  (`SUM(debit)==SUM(credit)`, integer minor units), expense_food debited / cash credited.
- Tap `discard` → no journal entry; typed "ya" behaves identically to tapping `confirm`
  (EC-CH-03).
- "jajan bakso" (no amount) → clarification question sent, **no** draft committed (EC-TXT-01).
- Second transaction while a draft is pending → new draft, old one not overwritten (EC-TXT-03).
- Pending draft left unanswered, advance the scheduled alarm → draft expired, no commit
  (EC-IMG-05).
- Non-transaction intent ("set budget makan 500rb") → graceful stub reply, no journal entry.
- Malformed/unparseable update → handler logs, returns 200, no crash (EC-CH-02).
- Inbound on an inactive channel → ignored before parsing (EC-CH-01).

### Supporting tests (smaller, focused seams)

- **`TelegramProvider` normalization** — pure unit test against the **real captured fixtures**
  (`.scratch/struku-v1/fixtures/telegram-updates.json`): plain text `Update` and
  reply-to-message `Update` → correct `NormalizedInboundMessage` (identity `chat.id`, `date×1000`
  millis, `replyToId`, `kind:'text'`); a `callback_query` tap → `{ kind:'text', text: id }`.
  No network, no D1.
- **Ledger writer balance enforcement** — unit test: a balanced draft commits; a
  deliberately-unbalanced set is rejected before any D1 write (FR-LDG-03); major→minor
  conversion is exponent-correct for IDR (×1) and USD (×100).
- **`TextParser` defensive layer + real-model contract** — a **non-gating** test (kept out of
  the CI gate because it needs credentials and is non-deterministic) exercises the real
  `@cf/meta/llama-3.3-70b-instruct-fp8-fast` contract, seeded by the spike battery
  (`.scratch/struku-v1/research/05-parsing-spike/`): flat schema, shorthand resolution,
  Indonesian extraction, clarification-not-invention. Separately, a deterministic unit test of
  the parse → Zod → one-retry → ask-to-rephrase wrapper feeding it canned malformed/valid JSON
  strings.

### Prior art

There is **no existing test suite** — `src/` is still the Vite/React/Hono starter template
and this is the first feature. So this slice **establishes** the testing conventions:
`vitest-pool-workers` for behavior-through-the-webhook, plain Vitest units for the provider and
ledger-writer seams, and the real captured Telegram fixtures + the spike result JSON as the
ground-truth inputs for provider normalization and the parser contract respectively.

## Out of Scope

Explicitly deferred to the map's fog (not built in this slice):

- **Image / receipt parsing** and the whole vision pipeline (R2 upload, `fileRef` resolution,
  OCR-accuracy validation) — tracer #1 is free-text only.
- **WhatsApp** / `WhatsAppProvider` and any second channel — Telegram only.
- **Budget, category, and query** intent handlers — these intents are *routed/classified* but
  their handlers are graceful stubs; no budget/category/query feature is built.
- **Own-account transfers** (asset→asset) — a third transaction shape beyond income/expense;
  may resolve to `unknown`/clarify for now.
- **Post-commit transaction editing / reclassification / reversal** (§3.7) — the schema
  reserves capacity (`status`, `reverses_entry_id`) but the correction flow is not built. Edit
  in tracer #1 means editing a *pending, uncommitted* draft only.
- **Multi-currency reporting/conversion** — a foreign-currency entry is *stored* correctly in
  its own currency, but Frankfurter rates, `exchange_rates`, and aggregated conversion
  (FR-CUR-03..05) are not built.
- **PDF reporting**, **read-only detail web view** + `detail_view_tokens`, **freemium limit
  enforcement** + Xendit, **Admin Console** (channel config/validation cycle, user/data/
  subscription oversight, audit log, Cloudflare Access), **multi-channel linking**, and the
  **full i18n resource layer** — all fog.
- **Full `channel_configs` schema + daily re-validation cycle** — the activation gate is
  present as a checkpoint (FR-CH-04), but for a single Telegram channel it may be satisfied by
  configuration/secret presence rather than a validated DB row; the DB-backed validation model
  arrives with the Admin Console.
- **Encryption-at-rest** for sensitive fields and UU PDP data-subject-rights mechanics
  (NFR-SEC-03) beyond the explicit consent step already in onboarding.

## Further Notes

- **Webhook setup is a build-time concern.** #01 deliberately used `getUpdates` long-polling to
  capture fixtures and did **not** register a webhook or store a secret. Standing up the live
  `setWebhook` + the `TELEGRAM_BOT_TOKEN` Workers Secret + deploy is part of implementing this
  slice, not already done. `getUpdates` and `setWebhook` are mutually exclusive.
- **Bindings to add to `wrangler.json`** (currently none configured): D1 (ledger), the Agents
  SDK `Agent` Durable Object binding + migration, and the Workers AI (`AI`) binding. Run
  `wrangler types` after. The `agents` SDK dependency must be added to `package.json`.
- **User-facing copy avoids accounting jargon** (NFR-USE-02): the user sees
  "Pengeluaran / Pemasukan," category names, and amounts — never "debit," "credit," or
  "journal entry," even though that's exactly what's stored.
- **The timeout default (30 min) is a proposal**, not an ADR-fixed value — the SRS leaves it "a
  defined timeout period" (EC-IMG-05). Pin it during implementation; it's trivially
  configurable since it's a `this.schedule` delay.
- **Latency budget is evidence-backed:** the #05 spike measured p50 ~1.7s / p95 ~2.4s for the
  parse call, comfortably inside NFR-PERF-01's 5–10s, so the confirm round-trip stays
  conversational.
- This slice is the composition point for ADRs 0001–0006; if an implementer finds any ADR
  detail that doesn't fit reality, that's an ADR revision (via `/domain-modeling`), not a
  silent deviation in code.
