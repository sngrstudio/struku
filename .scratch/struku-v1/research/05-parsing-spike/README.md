# #05 AI text-parsing spike — empirical findings

**Date:** 2026-07-31 · **Ticket:** [05 — AI text-parsing contract](../../issues/05-ai-text-parsing-contract.md)
· **Model:** `@cf/meta/llama-3.3-70b-instruct-fp8-fast` (JSON mode, `response_format:
json_schema`, `max_tokens: 512`), called live via a throwaway `wrangler dev` worker
proxying `env.AI.run` to production Workers AI.

Raw evidence: [`results-iter1-nested.json`](results-iter1-nested.json) (nested schema,
failed) · [`results-iter2-flat.json`](results-iter2-flat.json) (flat schema, passed).
Spike harness code was throwaway and deleted.

## The load-bearing finding: flat schema, not nested

**Iteration 1 — nested/discriminated schema** (`{ intent, transaction: {object|null}, … }`):
degraded badly. On `intent=transaction` rows the model filled only `transaction.type`
and dropped every other field; **2 of 6 transaction rows spiraled into a whitespace
loop** (`\n\t\n\t…` until `max_tokens`) → **~14.2–14.5s** and unparseable output.

**Iteration 2 — flat combined schema** (intent + top-level `txn_type/amount/currency/
category/date/clarification`, all nullable): **reliable and fast.** 0 failures across the
battery; the 14s tail disappeared entirely. Conclusion: the latency fat-tail was a
**symptom of schema degeneration, not model variance.** → Single flat call does both
routing and extraction; a separate cheap classifier is unnecessary.

## Latency (flat schema, NFR-PERF-01 budget = 5–10s)

`kopi 25rb` ×10: `min=1502 p50=1674 p90=2372 p95=2372 max=2372 ms`. Battery calls all
1.3–2.4s. **Well within budget with margin.** Note: JSON mode has no streaming (#07), so
this whole-response latency is the user-visible latency — still fine.

## Indonesian extraction (flat schema) — accurate despite `id` not on Meta's official list

| input | → intent / extraction |
|---|---|
| `bought coffee 25k` | txn expense / 25000 / IDR / food |
| `kopi 25rb` | txn expense / 25000 / IDR / food |
| `gaji masuk 5jt` | txn income / 5000000 / IDR / salary |
| `beli bensin 50rb` | txn expense / 50000 / IDR / transport |
| `bayar netflix 15 usd` | txn expense / 15 / **USD** / entertainment |
| `makan siang tadi di warteg 35 ribu pake gopay` | txn expense / 35000 / IDR / food |
| `set budget makan 500rb` | intent=budget (not extracted as txn) |
| `berapa pengeluaran bulan ini?` | intent=query |
| `jajan bakso tadi siang` | txn expense / **amount=null** + clarification *"Berapa biaya jajan bakso tadi siang?"* |
| `tambah kategori belanja bulanan` | intent=category |

- Shorthand (`k`/`rb`/`ribu`/`jt`) resolved correctly; verbose id parsed; noise
  (`pake gopay`) ignored; multi-currency (USD) handled.
- **Low-confidence:** missing amount → `amount=null` + a clarification question **in the
  user's language**, without inventing a number (EC-TXT-01 / EC-TXT-02 satisfied).
- **One miss:** `transfer 1.5jt buat tabungan` → classified `income` (amount 1500000 ok).
  Own-account transfers (asset→asset) don't fit the income/expense binary → graduated to
  fog, out of tracer #1.

## Cost

~11 neurons/call observed; ~40 calls total in this spike ≈ 440 neurons (~4.4% of the
10,000/day free allocation). Negligible at tracer-#1 scale.
