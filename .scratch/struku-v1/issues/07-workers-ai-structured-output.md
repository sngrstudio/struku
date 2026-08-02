# 07 — Workers AI text model: structured-output capability

Type: research
Status: resolved
Blocked by: —

## Question

Surface the facts ticket #05 waits on, against **primary sources** (Cloudflare Workers
AI docs). AFK — resolve via a `/research` subagent.

Questions to answer:

- Which Llama 3.x instruct-family text models are currently available on Workers AI,
  and which are appropriate for structured extraction / intent classification?
- Does Workers AI support **reliable structured (JSON) output** — response-format /
  JSON mode / function (tool) calling — or must we prompt-and-parse defensively?
- Practical **token limits** and **latency** characteristics vs NFR-PERF-01 (5–10s).
- Any locale/multilingual caveats relevant to id + en input (PRD §9).
- Same questions, briefly, for the **vision** model `@cf/meta/llama-3.2-11b-vision-instruct`
  (feeds the future image-parsing fog, but cheap to capture now).

Deliverable: a cited Markdown findings file on a `research/*` branch; link it back here.

## Answer

Findings: [`.scratch/struku-v1/research/07-workers-ai-structured-output.md`](../research/07-workers-ai-structured-output.md)
(every claim cited to primary Cloudflare docs + Meta's Llama model card).

Key facts for #05:

1. **Model pick.** `@cf/meta/llama-3.3-70b-instruct-fp8-fast` is the only active Llama 3.x
   text model tagged with **both** function-calling AND JSON mode — but context is only
   **24k tokens**. Lighter fallback `llama-3.1-8b-instruct-fast` (JSON mode, 128k, no tools).
   `llama-3.2-3b-instruct` supports neither.
2. **JSON mode is real** (OpenAI-style `response_format`), but Cloudflare states verbatim it
   **"can't guarantee"** schema conformance, and JSON mode has **no streaming** → we still
   parse-validate-**retry** defensively. Also `max_tokens` defaults to **256**, must be raised.
3. **⚠️ Latency unknown** — Cloudflare publishes no latency/throughput numbers, so NFR-PERF-01
   (5–10s) **cannot be confirmed from docs**; needs an empirical benchmark in #05's spike.
4. **⚠️ Indonesian is a risk** — Cloudflare doesn't list languages; Meta's card officially
   supports 8 (English yes, **`id` NOT among them**). Validate `id` extraction empirically.
5. Vision model `llama-3.2-11b-vision-instruct` IS in the JSON-mode list (128k, same no-guarantee
   caveats), not function-calling tagged — feeds the future image-parsing fog.
