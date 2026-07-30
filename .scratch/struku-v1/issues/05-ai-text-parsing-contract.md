# 05 — AI text-parsing contract (transaction path)

Type: prototype
Status: open
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

_(ADR link + spike findings)_
