# 13 — Pending draft, confirm/edit/discard, double-entry commit, timeout

**What to build:** The full record-a-transaction loop. After the bot understands a
transaction it offers Confirm / Edit / Discard, and on confirm a balanced double-entry
journal entry is committed to the ledger. Unanswered drafts expire on their own. This closes
tracer-bullet #1: a real Telegram user can record a transaction end to end.

Grounded in [spec.md](../spec.md) and ADR-0002/0004/0005/0006.

**Blocked by:** 12.

**Status:** ready-for-agent

- [ ] After a `transaction`-intent parse with all essential fields present, the Agent stores a **pending draft** (with its DO-minted UUIDv7 entry id) and sends a choice prompt with `confirm` / `edit` / `discard`.
- [ ] The reply is matched on normalized `text`, so a typed synonym ("ya"/"oke"/"👍") behaves identically to tapping a button (EC-CH-03).
- [ ] `confirm` → the ledger writer resolves the account pair by `(user_id, slug)`, converts the major-unit amount to **minor units** via `currencies.exponent`, runs the app-layer balance check (≥2 lines, all share the entry currency, `SUM(debit) == SUM(credit)`, integer-exact) **before** any write, commits `journal_entries` + `journal_lines`, clears the draft, cancels the timeout, and sends an acknowledgement.
- [ ] An unbalanced set is rejected before any D1 write (FR-LDG-03).
- [ ] `discard` → draft cleared, no journal entry. `edit` → the relevant pending-draft field(s) (amount/category/date/direction) are corrected and re-summarized before commit. (Post-commit editing is out of scope — §3.7 fog.)
- [ ] A pending draft left unanswered expires via a scheduled alarm (`this.schedule`; default **30 min**, configurable — pin the value) with no commit (EC-IMG-05); an expired draft can simply be re-sent.
- [ ] A new transaction message while a draft is pending starts a **new** draft rather than overwriting the pending one (EC-TXT-03).
- [ ] Concurrent confirmations on the same user's ledger are serialized by the per-user Agent, with no entry lost or duplicated (EC-LDG-02).
- [ ] Verified through the webhook seam end-to-end: message → tap/type confirm → exactly one balanced journal entry in D1 (expense_food debited / cash credited for "kopi 25rb"); discard and timeout leave the ledger untouched. A ledger-writer unit test covers major→minor conversion (IDR ×1, USD ×100) and balance rejection.
