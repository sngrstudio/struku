# 05 — AI text-parsing contract (transaction path)

Type: prototype
Status: resolved
Blocked by: 04

## Question

Define the contract between an inbound normalized text message and structured intent.
Blocked by #04 (consumes the normalized inbound text shape). Informed by #07 (Workers
AI structured-output capability). Scoped to the **transaction-recording path** for
tracer-bullet #1 — budget/category/edit routing is designed but only stubbed now.

Pin down:

- The **intent router**: transaction vs budget vs category vs query disambiguation
  (FR-TXT-04) — one model call with a discriminated output, or a cheap classifier first?
- The **extraction JSON schema** for a transaction: type (income/expense), amount,
  currency, category, date (default = today in user's tz, FR-TXT-02).
- **Low-confidence behavior**: ask a clarifying question rather than guess (EC-TXT-01);
  surface resolved absolute amount for shorthand like "25k"/"5jt" (EC-TXT-02).
- Latency budget vs NFR-PERF-01 (5–10s end-to-end).

**Must validate empirically in the spike (from resolved #07):**
- **Latency** — Cloudflare publishes no numbers; confirm the round-trip fits NFR-PERF-01 (5–10s).
- **Indonesian** — `id` is NOT on Llama's official language list; verify `id` extraction quality
  ("gaji masuk 5jt", "kopi 25rb") before committing to the model.
- **Schema conformance** — JSON mode is not guaranteed; design for parse-validate-retry, and
  raise `max_tokens` above the 256 default. Model shortlist: `llama-3.3-70b-instruct-fp8-fast`
  (fn-calling+JSON, 24k ctx) vs `llama-3.1-8b-instruct-fast` (JSON, 128k, no tools).

Deliverable: ADR + a `/prototype` spike running real phrasings ("bought coffee 25k",
"gaji masuk 5jt") through the model to sanity-check the schema + router. Keep the prompt
**locale-parameterized** (PRD §9), not id-hardcoded.

## Answer

→ [ADR-0005](../../../docs/adr/0005-ai-text-parsing-contract.md) · spike evidence:
[research/05-parsing-spike/](../research/05-parsing-spike/README.md)

**Empirical (live spike vs `llama-3.3-70b-instruct-fp8-fast`, JSON mode):**
- **Latency proven:** p50 ~1.7s / p95 ~2.4s — inside NFR-PERF-01 (5–10s). The 14s tail
  seen early was schema degeneration, not model variance.
- **Indonesian proven:** accurate extraction + shorthand (`25rb`→25000, `5jt`→5000000),
  multi-currency (USD), verbose id, noise-tolerant — despite `id` not on Meta's list.
- **Load-bearing:** a **nested** schema degrades (type-only + whitespace spiral); a
  **flat** schema is reliable → single flat call, no separate classifier.

**Decisions:**
1. Single **flat** call routes (`intent`) **and** extracts, in one `env.AI.run`.
2. Model locked: `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, `response_format:
   json_schema`, `max_tokens` ≥ 512.
3. Schema: `intent` (transaction|budget|category|query|unknown) + top-level nullable
   `txn_type`/`amount`/`currency`/`category`/`date`/`clarification`.
4. **Amount = major/absolute**; app converts to minor units via `currencies.exponent`
   (ADR-0002). LLM never touches exponents.
5. **Category = enum of canonical ADR-0002 slugs** → deterministic `(user_id, slug)`.
6. Low-confidence → `amount=null` + `clarification` in user's language; never invent
   (EC-TXT-01/02).
7. Defensive: parse → **Zod validate** → **1 retry** → else ask to rephrase.
8. Prompt **locale-parameterized** (PRD §9); keys English, values id.

**Scope:** only the transaction path is fully specified; budget/category/query are routed
but stubbed. **Transfers (asset→asset)** graduated to fog — don't fit income/expense.
Spike harness code was throwaway (deleted); findings + raw results preserved under
`research/05-parsing-spike/`.
