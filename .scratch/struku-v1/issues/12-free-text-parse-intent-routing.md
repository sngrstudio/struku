# 12 — Free-text parse & intent routing: understand, clarify, route (no commit)

**What to build:** An onboarded user types a transaction in natural language and the bot
demonstrably understands it — echoing back a plain-language interpretation, asking a
clarifying question when something essential is missing, and gracefully handling
non-transaction messages — with nothing yet written to the ledger. This isolates the AI
integration risk from the ledger commit.

Grounded in [spec.md](../spec.md) and ADR-0005 (+ #05 spike).

**Blocked by:** 09, 11.

**Status:** ready-for-agent

The Agent calls a single injectable `TextParser` port returning this validated `ParseResult`
(from the #05 prototype/ADR-0005 — the exact contract the reply and later confirm flow
consume):

```ts
interface ParseResult {
  intent: 'transaction' | 'budget' | 'category' | 'query' | 'unknown';
  txn_type: 'income' | 'expense' | null;
  amount: number | null;        // MAJOR/absolute units; app converts to minor later
  currency: string;             // ISO-4217, default 'IDR'
  category: string | null;      // enum of canonical ADR-0002 slugs
  date: string | null;          // 'YYYY-MM-DD'; null → app fills today-in-user-timezone
  clarification: string | null; // in the user's language when an essential field is missing
}
```

- [ ] The real `TextParser` implementation is the ADR-0005 contract: one **flat** `env.AI.run` call on `@cf/meta/llama-3.3-70b-instruct-fp8-fast` (JSON mode, `max_tokens ≥ 512`), then parse → Zod-validate → **one** retry → ask-to-rephrase.
- [ ] `transaction` intent → a plain-language summary reply with the **resolved absolute** amount (e.g. "Rp 25.000"; shorthand `25rb`/`25k`/`5jt`/`1.5jt` resolved), category (canonical slug), direction (income/expense), and date (defaulting to today in the user's timezone when omitted) — but **no** confirm buttons and **no** commit.
- [ ] A missing essential field (e.g. no amount) yields a clarification question **in the user's language** and no draft; the bot never fabricates an unstated amount (EC-TXT-01/02).
- [ ] `budget` / `category` / `query` intents are classified and answered with a graceful "not built yet" stub; `unknown` → ask to rephrase. No non-transaction message is recorded as a spend.
- [ ] Amount stays major-unit out of the model (app owns the exponent conversion); `currency` defaults to IDR; a foreign-currency message keeps its currency. The prompt is locale-parameterized (`${LOCALE}`), not `id`-hardcoded.
- [ ] Deterministic gating tests inject a **fake** `TextParser` returning canned `ParseResult`s (clean expense, income, foreign-currency, missing-amount clarification, non-transaction intent). A separate **non-gating** contract test exercises the real model seeded by the #05 spike battery; a unit test covers the parse→Zod→retry wrapper on canned JSON strings.
- [ ] User-facing copy carries no accounting jargon (NFR-USE-02); responses land within the NFR-PERF-01 budget.
