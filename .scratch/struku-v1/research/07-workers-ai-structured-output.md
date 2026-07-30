# 07 — Workers AI text model: structured-output capability (research findings)

Ticket: `.scratch/struku-v1/issues/07-workers-ai-structured-output.md`
Date: 2026-07-31
Sources: **primary only** — Cloudflare Workers AI docs + model catalog (`developers.cloudflare.com`), plus Meta's official Llama 3.1 model card for the multilingual claim that Cloudflare does not enumerate.

> Scope note: The Cloudflare model catalog is versioned/live; IDs and property tables below reflect the pages as fetched on 2026-07-31. Re-verify IDs before wiring, since deprecated variants get pruned.

---

## 1. Available Llama 3.x instruct TEXT models & fit for extraction / intent classification

From the Workers AI model catalog ([models index](https://developers.cloudflare.com/workers-ai/models/)):

| Model ID | Context window | Status | Function calling | JSON mode | Notes |
|---|---|---|---|---|---|
| `@cf/meta/llama-3-8b-instruct` | (not stated on catalog) | active | no | **yes** (in JSON-mode list) | oldest 3.x |
| `@cf/meta/llama-3.1-8b-instruct` | 128,000 | **deprecated** | no | **yes** | avoid (deprecated) |
| `@cf/meta/llama-3.1-8b-instruct-awq` | — | **deprecated** | no | — | int4 quant, avoid |
| `@cf/meta/llama-3.1-8b-instruct-fp8` | — | active | no | — | fp8 quant |
| `@cf/meta/llama-3.1-8b-instruct-fast` | 128,000 | active | no | **yes** | fast variant |
| `@cf/meta/llama-3.1-70b-instruct` | — | **deprecated** | no | **yes** | avoid (deprecated) |
| `@cf/meta/llama-3.2-1b-instruct` | (not stated) | active | no | no | tiny |
| `@cf/meta/llama-3.2-3b-instruct` | 80,000 | active | **no** | no | cheapest |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | **24,000** | active | **yes** | **yes** | best structured-output fit |

Per-model context windows: 3.3-70b-fp8-fast = "Context Window: 24,000 tokens" ([page](https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/)); 3.1-8b-instruct-fast = "Context Window: 128,000 tokens" ([page](https://developers.cloudflare.com/workers-ai/models/llama-3.1-8b-instruct-fast/)); 3.2-3b-instruct = "80,000 tokens" ([page](https://developers.cloudflare.com/workers-ai/models/llama-3.2-3b-instruct/)).

**Recommendation for structured extraction / intent classification:**

- **Primary: `@cf/meta/llama-3.3-70b-instruct-fp8-fast`.** It is the only active Llama 3.x text model tagged with **both** Function calling: Yes and present in the JSON-mode model list ([3.3-70b page](https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/), [JSON mode](https://developers.cloudflare.com/workers-ai/features/json-mode/)). Caveat: its context window is only **24k tokens**, materially smaller than the 8B's 128k.
- **Lighter/cheaper: `@cf/meta/llama-3.1-8b-instruct-fast`.** Supports JSON mode and has a 128k window, but **no function calling** ([JSON mode list](https://developers.cloudflare.com/workers-ai/features/json-mode/)). Good if you only need `response_format` JSON, not tools.
- **`@cf/meta/llama-3.2-3b-instruct`** is cheapest ($0.051/$0.335 per M tokens) but supports **neither** function calling **nor** JSON mode → prompt-and-parse only ([3.2-3b page](https://developers.cloudflare.com/workers-ai/models/llama-3.2-3b-instruct/), pricing below).

> Aside (out of Llama-3.x scope but noted): the catalog also filters `@cf/meta/llama-4-scout-17b-16e-instruct` under Function calling ([catalog filter](https://developers.cloudflare.com/workers-ai/models/?capabilities=Function+calling)). Not evaluated here.

---

## 2. Reliable structured JSON output? — Yes, but NOT guaranteed → still validate defensively

**JSON mode exists.** Workers AI implements OpenAI-compatible structured output via a `response_format` property whose `type` is `json_object` or `json_schema`, with a JSON Schema in the `json_schema` field ([JSON mode docs](https://developers.cloudflare.com/workers-ai/features/json-mode/)).

Models supporting JSON mode (verbatim from the docs list):
- `@cf/meta/llama-3.1-8b-instruct-fast`
- `@cf/meta/llama-3.1-70b-instruct`
- `@cf/meta/llama-3.3-70b-instruct-fp8-fast`
- `@cf/meta/llama-3-8b-instruct`
- `@cf/meta/llama-3.1-8b-instruct`
- `@cf/meta/llama-3.2-11b-vision-instruct`
- `@cf/deepseek-ai/deepseek-r1-distill-qwen-32b`
- (docs also reference Hermes 2 Pro Mistral 7B and a DeepSeek Coder variant)

**Two hard caveats — this is the load-bearing finding:**

1. **No schema guarantee.** Verbatim: *"Workers AI can't guarantee that the model responds according to the requested JSON Schema."* ([JSON mode docs](https://developers.cloudflare.com/workers-ai/features/json-mode/)). → We MUST parse-and-validate the output (e.g. Zod/schema check) and handle failure, even with JSON mode on. It is a strong prior, not a contract.
2. **No streaming.** Verbatim: *"JSON Mode currently doesn't support streaming."* ([JSON mode docs](https://developers.cloudflare.com/workers-ai/features/json-mode/)). → The full JSON response must complete within the latency budget; you cannot stream partial tokens to hide latency.

**Function (tool) calling** is separately supported. Docs describe embedded (via `@cloudflare/ai-utils`) and traditional function calling ([function calling](https://developers.cloudflare.com/workers-ai/features/function-calling/), [traditional](https://developers.cloudflare.com/workers-ai/features/function-calling/traditional/)). Among Llama 3.x text models, only `@cf/meta/llama-3.3-70b-instruct-fp8-fast` is catalog-tagged with Function calling: Yes ([catalog filter](https://developers.cloudflare.com/workers-ai/models/?capabilities=Function+calling)). The generic function-calling pages illustrate with `@hf/nousresearch/hermes-2-pro-mistral-7b`, not Llama.

**Verdict:** For Struku extraction, use `response_format` JSON mode on `llama-3.3-70b-instruct-fp8-fast` (or the 8b-fast) **and** wrap it in defensive parse+validate+retry. Do not assume schema compliance.

---

## 3. Token limits & latency vs the 5–10s (NFR-PERF-01) budget

**Token / context limits** (all cited above):
- `llama-3.3-70b-instruct-fp8-fast`: **24,000** total context — the notable constraint. A large receipt/document prompt + schema + output must fit under 24k.
- `llama-3.1-8b-instruct-fast`: 128,000. `llama-3.2-3b-instruct`: 80,000.
- Default output cap is small: `max_tokens` **default: 256** on these pages — you must raise `max_tokens` explicitly for non-trivial JSON, or output will be truncated ([3.3-70b page](https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/)).

**Latency — AMBIGUOUS / NOT DOCUMENTED.** Cloudflare's pricing and model pages publish **no latency, throughput, or response-time figures** for these models ([pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)). I could not find a first-party latency SLA or benchmark. What the docs *do* signal indirectly:
- The `-fast` and `-fp8` suffixes denote speed-optimized/quantized variants (3.3-70b page: *"quantized to fp8 precision, optimized to be faster"*).
- JSON mode disables streaming (§2), so the **entire** response latency counts against the 5–10s budget with no first-token masking.

→ **Cannot confirm the 5–10s budget from docs alone.** Recommend an empirical benchmark (p50/p95 end-to-end) on the actual prompt sizes before committing. The 70B model at 24k context with a full JSON payload is the latency risk; the 8B-fast / 3B are lower-latency fallbacks.

**Pricing** (context for model choice), from [pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/):
- `llama-3.3-70b-instruct-fp8-fast`: $0.293 / M input, $2.253 / M output.
- `llama-3.2-3b-instruct`: $0.051 / M input, $0.335 / M output.
- `llama-3.1-8b-instruct-fast`: not listed in the fetched pricing table (re-verify).

---

## 4. Multilingual caveats for Indonesian (id) + English (en)

**Cloudflare docs do not enumerate supported languages.** Every relevant model page says only *"optimized for multilingual dialogue use cases"* and does **not** list which languages ([3.1-8b page](https://developers.cloudflare.com/workers-ai/models/llama-3.1-8b-instruct/), [3.2-3b page](https://developers.cloudflare.com/workers-ai/models/llama-3.2-3b-instruct/)). So Cloudflare itself is **silent/ambiguous** on Indonesian — flagging this explicitly per the ticket.

**The owning source (Meta's Llama model card) is more restrictive.** Llama 3.1 (the base for 3.1/3.3 on Workers AI) officially supports **8 languages: English, German, French, Italian, Portuguese, Hindi, Spanish, Thai** — verbatim: *"Supported languages: English, German, French, Italian, Portuguese, Hindi, Spanish, and Thai."* ([Meta Llama-3.1-8B-Instruct model card](https://huggingface.co/meta-llama/Llama-3.1-8B-Instruct)). The card adds it was *"trained on a broader collection of languages than the 8 supported languages"* but advises against unsupported-language use *"without implementing finetuning and system controls."*

**Implication for Struku:**
- **English (en): fully supported.** No caveat.
- **Indonesian (id): NOT on Meta's official supported list.** The model has likely seen Indonesian in pretraining (it usually handles it in practice), but it is officially unsupported — quality/consistency is not guaranteed, especially for strict structured extraction. This is a real risk for the `id` locale in PRD §9.
- Mitigation to evaluate empirically: keep the JSON *schema/keys/instructions in English* while allowing Indonesian *values*, and benchmark extraction accuracy on real Indonesian inputs before relying on it.

---

## 5. Vision model `@cf/meta/llama-3.2-11b-vision-instruct` — structured output

- **JSON mode: YES.** It appears verbatim in the JSON-mode supported-model list ([JSON mode docs](https://developers.cloudflare.com/workers-ai/features/json-mode/)) — so `response_format` (`json_object`/`json_schema`) works, subject to the **same two caveats**: no schema guarantee, no streaming.
- **Function calling: not catalog-tagged** for this model (it does not appear under the Function-calling filter); its output schema lists `tool_calls` but the page makes no affirmative function-calling claim ([model page](https://developers.cloudflare.com/workers-ai/models/llama-3.2-11b-vision-instruct/)).
- **Context window: 128,000 tokens**; `max_tokens` default 256 (raise it) ([model page](https://developers.cloudflare.com/workers-ai/models/llama-3.2-11b-vision-instruct/)).
- **Languages:** Cloudflare page gives no language list; Meta treats Llama 3.2 vision's text side under the same supported-language framing (English yes, Indonesian not officially supported) — treat the §4 caveat as applying here too. Cloudflare docs are ambiguous on this; flag before relying on Indonesian image-text extraction.

**Takeaway:** the vision model is viable for structured image parsing via JSON mode with the same defensive-parsing requirement; no function calling.

---

## TL;DR for ticket #05

1. Use **`@cf/meta/llama-3.3-70b-instruct-fp8-fast`** as the structured-extraction model (only active 3.x with function calling + JSON mode) — but mind its **24k** context window. `llama-3.1-8b-instruct-fast` (JSON mode, 128k, no tools) is the cheaper/lighter fallback; `llama-3.2-3b-instruct` has neither and needs pure prompt-and-parse.
2. JSON mode is real (`response_format`) **but Cloudflare explicitly does not guarantee schema compliance and JSON mode has no streaming** → always parse-validate-retry.
3. **Latency is undocumented by Cloudflare** — cannot verify 5–10s from docs; benchmark empirically. Raise `max_tokens` (default 256).
4. **Indonesian is not an officially supported Llama language** (Meta lists 8, id not among them); Cloudflare docs are silent. English is safe; validate `id` empirically.
5. Vision model supports JSON mode (same caveats), no function calling, 128k context.
