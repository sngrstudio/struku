# AI text-parsing contract: single flat intent+extraction call, major-unit amounts, canonical-slug categories

**Status:** accepted

## Context

The transaction-recording path of tracer-bullet #1 turns a
[normalized inbound text message](0004-messaging-provider-seam.md) into a structured
intent the app can act on (FR-TXT-01..04). [Ticket #07's research](../../.scratch/struku-v1/research/07-workers-ai-structured-output.md)
left two risks unproven — Workers AI **latency** (Cloudflare publishes none; NFR-PERF-01
wants 5–10s) and **Indonesian** quality (`id` is not on Meta's official Llama language
list) — plus a hard fact: JSON mode is a strong prior, **not** a schema guarantee. This
ADR fixes the parsing contract, resolved together with a live spike against
`@cf/meta/llama-3.3-70b-instruct-fp8-fast`. Spike findings (the empirical basis for
everything below):
[`.scratch/struku-v1/research/05-parsing-spike/`](../../.scratch/struku-v1/research/05-parsing-spike/README.md).

## Decision

### 1. A single **flat** call does both routing and extraction

One `env.AI.run` call returns intent **and** (for transactions) the extracted fields, in
one **flat** JSON object — no nested sub-objects. The spike is load-bearing here: a
nested/discriminated schema (`{ intent, transaction: {…}|null }`) degraded to
type-only extraction and **spiraled into a whitespace loop that blew past 14s** on some
inputs, whereas the flat schema was reliable and ~1.7s. So the ticket's "one call vs a
cheap classifier first" is answered: **one flat call**, no separate classifier.

### 2. Model locked: `@cf/meta/llama-3.3-70b-instruct-fp8-fast`

JSON mode via `response_format: { type: "json_schema", json_schema }`, `max_tokens` ≥ 512
(the 256 default truncates). Proven in the spike: latency **p50 ~1.7s / p95 ~2.4s**
(inside NFR-PERF-01's 5–10s with margin), Indonesian extraction accurate, ~11 neurons/
call. No streaming in JSON mode (#07), so whole-response latency is the user-visible
latency — still fine. A cheaper 8B fallback is **not** built; revisit only if cost/
latency becomes a problem at scale (its own ticket).

### 3. Extraction schema (transaction path)

Flat object, `intent` required, everything else nullable:

- `intent`: `transaction | budget | category | query | unknown`
- `txn_type`: `income | expense | null`
- `amount`: number | null — **major/absolute** units with shorthand resolved
  (`25k`/`25rb`→25000, `5jt`→5000000, `1.5jt`→1500000)
- `currency`: ISO-4217 string, default `IDR`
- `category`: enum of **canonical ADR-0002 slugs** (see §5)
- `date`: `YYYY-MM-DD | null`
- `clarification`: string | null (see §6)

### 4. Amount unit boundary: AI emits major, app converts to minor

The model returns the human/absolute number (`25000` for Rp 25.000, `15` for $15) plus
the currency code. The **app** converts to the integer minor units the ledger stores,
using `currencies.exponent` from [ADR-0002](0002-double-entry-ledger-schema.md) (IDR
exp 0 → ×1, USD exp 2 → ×100). The LLM never handles per-currency exponents — that
arithmetic is deterministic app code, and keeping it there protects the multi-currency
path (where a wrong ×100 would corrupt a balance) from model error.

### 5. Category is an enum of canonical slugs

`category` is constrained by the JSON schema to the exact expense/income slugs from
ADR-0002's default chart (`food`, `transport`, `shopping`, `bills`, `entertainment`,
`health`, `other`; `salary`, `freelance`, `other`). This yields a deterministic
`(user_id, slug)` mapping into the chart with no fuzzy post-mapping step — and the spike
showed the model picks these naturally. Custom/user-defined categories are out of tracer
#1.

### 6. Low-confidence: clarify, never invent

When an essential field (e.g. amount) is missing, the model sets the field `null` and
puts a short question **in the user's language** in `clarification`, rather than guessing
(EC-TXT-01), and never fabricates an unstated amount (EC-TXT-02). Both were exercised
successfully in the spike. Absolute-amount resolution of shorthand is surfaced so the
confirm step shows e.g. "Rp 25.000", not "25k".

### 7. Defensive contract: parse → validate → one retry → ask to rephrase

Every response is `JSON.parse`d **and** validated with Zod against the contract schema
(not merely parsed). On failure (broken JSON, invalid field, out-of-enum): **one** retry
with the same prompt plus a short error note; if it still fails, ask the user to rephrase
rather than guessing. This follows #07 (JSON mode is not a guarantee) and the nested-schema
degeneration we observed directly; the 1-retry cap keeps worst-case latency ~2× (still in
budget).

### 8. Locale-parameterized prompt (PRD §9)

Schema keys and instructions stay **English**; values may be Indonesian (the #07
mitigation). The system prompt carries a `${LOCALE}` placeholder standing in for the i18n
resource layer — not `id`-hardcoded.

## Scope

Only the **transaction** path is fully specified (tracer #1). `budget`/`category`/`query`
intents are **routed** (classified) but their handlers are stubbed. `date` defaulting to
"today in the user's timezone" is done at the **app** layer (model returns `null` when no
date is stated; app fills it) so timezone logic stays out of the model.

## Consequences

- NFR-PERF-01 is now evidence-backed (p95 ~2.4s), not assumed; the Indonesian risk from
  #07 is retired for the text path (image/OCR path is separate fog).
- Own-account **transfers** (asset→asset) don't fit the income/expense binary and are
  graduated to fog as their own future ticket; until then the router may mark them
  `unknown`/clarify.
- The contract's output is the input to the pending-draft/confirm flow held in the
  per-user DO (ADR-0001) and, on confirm, the double-entry commit (ADR-0002).
- Traces: FR-TXT-01..04, EC-TXT-01, EC-TXT-02, NFR-PERF-01, PRD §9; builds on ADR-0002
  (minor units, chart slugs), ADR-0004 (normalized text in).
