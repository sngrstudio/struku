# Product Requirements Document: Struku

**Product Name:** Struku
**Document Status:** Draft v3
**Owner:** Ilham
**Date:** July 30, 2026

---

## 1. Overview

Struku is an AI-powered personal finance bot delivered through chat messaging. Users record income and expenses by forwarding a photo (receipt, invoice, or transfer proof) or typing a natural-language message, while the underlying ledger is maintained as a proper double-entry accounting system. The product is **chat-first**: nearly every user-facing action — recording transactions, setting budgets, managing categories, editing entries, and requesting reports — happens inside the chat conversation itself. A lightweight, read-only web view exists only for the narrow case where a user explicitly asks to see detailed transaction data that would be awkward to render as a chat message.

**Messaging channel model:** Struku supports **WhatsApp and Telegram simultaneously** as two concurrently available channels. Each channel is governed by the **Admin Console**: a channel is only live for end users once its configuration has been entered *and validated* (a live connection/webhook test must pass) in the Admin Console. An unconfigured or failed-validation channel is simply inactive — no bot behavior runs on it. A single user account may be linked to **both** channels at once and can record or query from either interchangeably.

### 1.1 Problem Statement

Personal finance tracking has high adoption friction: users must open a dedicated app and manually enter data, which leads to abandonment within weeks. Chat apps, in contrast, are already open on users' phones throughout the day. By reducing the recording action to "forward a photo" or "type a short message" — and by meeting users on whichever chat app they already use (WhatsApp or Telegram) — Struku removes the primary barrier to consistent financial tracking.

### 1.2 Target Users

Freelancers, urban professionals, and general consumers who want to track personal cash flow without learning dedicated accounting software.

---

## 2. Goals and Non-Goals

### 2.1 Goals

- Enable transaction recording via chat messaging using photos (receipts, invoices, transfer confirmations) or free-text input, over a channel-agnostic messaging layer.
- Support **WhatsApp and Telegram as simultaneously available channels**, each independently enabled/disabled based on validated configuration in the Admin Console.
- Allow a single user to link and use **multiple channels concurrently** for the same account.
- Automatically extract structured transaction data (merchant, amount, date, category) from images using AI.
- Persist all transactions as **double-entry journal entries**, not as a flat income/expense list, to ensure accuracy and auditability.
- Support the full range of routine actions — recording, budgeting, categorization, editing/reclassifying, and reporting — **entirely within chat**, using natural-language parsing rather than requiring a web UI.
- Support **multi-currency accounting**, since a single user may hold or transact in more than one currency.
- Operate as a **multi-tenant SaaS platform**, with strict data isolation between users, distributed under a freemium commercial model.
- Provide a minimal, on-demand, read-only web view for detailed transaction data when a chat reply is insufficient — not a general-purpose dashboard.

### 2.2 Non-Goals (Out of Scope for v1)

- A general-purpose web dashboard as the primary interface — the product is chat-first; the web view is a narrow, read-only supplement.
- Business/SME accounting features (invoicing, tax computation, VAT reporting, etc.).
- Shared or family ledgers — each user maintains a single, individual ledger in v1.
- Direct bank account integration (open banking / account aggregation) — data ingestion in v1 is limited to images and text.
- Team structure, staffing, or delivery timelines — this document is scoped to product requirements only, as the system is being built with AI-assisted development.

---

## 3. User Personas

| Persona | Core Need |
|---|---|
| Freelancer / solo entrepreneur | Fast visibility into monthly cash flow without switching tools |
| Salaried urban professional | Budget control and proactive alerts on overspending |
| Previously churned finance-app user | An entry point with minimal friction |

---

## 4. Core User Flows

### 4.1 Onboarding

1. User initiates a conversation with the Struku bot on any **active** channel (WhatsApp or Telegram — whichever is validated and enabled in the Admin Console).
2. The bot responds with a welcome message and a link to a brief consent/Terms of Service notice.
3. The bot collects baseline preferences: display name, primary reporting currency (default: IDR), and timezone (default: WIB), with language preference captured for i18n support (see §9).
4. An account is provisioned automatically on the **Free** tier, with this channel set as the user's first active `channel_identity`.

### 4.2 Recording via receipt / invoice / transfer proof image

1. User sends a photo via any active, linked channel.
2. The image is uploaded to R2 and passed to the AI parsing pipeline (Workers AI vision model).
3. The model extracts: merchant/counterparty, amount, currency, date, and a suggested category.
4. **If parsing succeeds**, the bot replies with a structured summary of the extracted data and asks the user to confirm ("✅ Confirm" / "✏️ Edit" / "❌ Discard").
5. **If parsing fails** (image unreadable, low confidence, or no extractable data), the bot informs the user and requests manual entry of the transaction details instead of retrying automatically.
6. Upon confirmation, the system generates a balanced double-entry journal entry and commits it to D1.

### 4.3 Recording via free-text input

1. User sends a natural-language message, e.g., *"bought coffee 25k"* or *"salary received 5,000,000"*.
2. The text model extracts transaction type (income/expense), amount, currency, category, and date (defaulting to the current date if omitted).
3. The bot presents the parsed result for confirmation, following the same confirm/edit/discard pattern as §4.2.

### 4.4 Budgeting and category management (chat-native)

1. User sets or adjusts a budget using natural language, e.g., *"set budget makan 500rb"* or *"/budget food 500000"* — both strict-command and natural-language phrasing are accepted and parsed by the same AI text-parsing pipeline used for transactions.
2. User creates or edits categories similarly, e.g., *"tambah kategori Belanja Bulanan"* or *"/category add Monthly Groceries"*.
3. The bot confirms the resulting state back in chat (e.g., "Budget for Food set to Rp500,000/month ✅").
4. No web UI is required for these actions; strict slash-command syntax is supported for Telegram-style familiarity, but is not required, since WhatsApp has no native command menu.

### 4.5 Editing and reclassifying transactions (chat-native)

1. User replies to a previously sent transaction confirmation message (or references it in text, e.g., *"the coffee I bought earlier was actually 30k, not 25k"*) to request a correction.
2. The bot resolves which transaction is being referenced (via reply-to-message context where the channel supports it, or via recency/description matching otherwise) and asks for confirmation of the change.
3. On confirmation, the corresponding `journal_entries`/`journal_lines` are updated (or reversed and re-posted, to preserve auditability) — no dashboard interaction required.

### 4.6 Reporting and ad-hoc queries

1. Users may query the bot at any time, e.g., *"this month's report"*, *"how much did I spend on food this week"*, *"remaining budget for shopping"*.
2. The bot replies with a concise text summary directly in chat.
3. For a full monthly report, the bot **generates and sends a PDF file directly in the chat conversation** (not a link to an external page) — consistent with the chat-first principle.
4. Opt-in recurring summaries (weekly/monthly) are sent proactively the same way: text summary in chat, with a generated PDF for the full report.

### 4.7 On-demand detailed transaction view (read-only web view)

1. When a chat summary isn't sufficient — e.g., the user asks *"tampilkan rincian pengeluaran bulan ini"* ("show me this month's expense breakdown in detail") — the bot replies with a **short-lived, single-use link** to a minimal read-only web view.
2. This view is triggered **only on explicit user request** (e.g., via a `/details` command or an equivalent natural-language ask); it is never auto-attached to every report.
3. Scope of the view: a filterable/searchable list of the transactions matching the request (e.g., this month's expenses), with receipt/attachment image preview per transaction. No editing, no budget/category management, and no account settings live here — those remain chat-native per §4.4–§4.5.
4. The link expires quickly and is single-use; there is no persistent "logged in" dashboard session.

### 4.8 Linking an additional channel (self-service, chat-native)

1. From an already-linked channel (e.g., Telegram), the user issues a link request, e.g., `/link whatsapp` or *"connect my WhatsApp"*.
2. The bot generates a short-lived one-time code and instructs the user to send it to the Struku bot on the target channel (WhatsApp), provided that channel is currently active per the Admin Console.
3. The user sends the code from the new channel. The bot matches the code to the pending request and creates a new active `channel_identity` for the same `user_id`.
4. Both channels are now usable interchangeably for the same account (§2.1). No dashboard or admin involvement is required for this routine case.
5. **Exception path:** if a user loses access to all previously linked channels and cannot complete the code exchange, this becomes a manual support case handled via the Admin Console (see §5.3).

---

## 5. Feature Set

### 5.1 MVP (v1) — Required

- [ ] Transaction recording via receipt/invoice/transfer-proof image (AI-assisted extraction)
- [ ] Transaction recording via free-text natural-language input
- [ ] Confirm/edit step prior to final commit
- [ ] Manual-entry fallback flow when image parsing fails
- [ ] Double-entry journaling engine with a default personal-finance chart of accounts
- [ ] Multi-currency support (per-transaction currency, multi-currency balances, primary reporting currency with auto-conversion)
- [ ] Multiple asset accounts per user (e.g., separate cash, bank, and e-wallet balances)
- [ ] Chat-native budget setting and category management (natural language + optional slash-command syntax)
- [ ] Chat-native transaction editing/reclassification (reply-to-correct pattern)
- [ ] Monthly and ad-hoc reports delivered as **PDF files sent directly in chat**
- [ ] On-demand, short-lived, read-only detailed transaction view (triggered manually, not auto-attached)
- [ ] Channel-agnostic messaging adapter layer supporting **WhatsApp and Telegram concurrently**
- [ ] Self-service, chat-native multi-channel linking (§4.8)
- [ ] Default and user-defined transaction categories
- [ ] Multi-tenant architecture with strict per-user data isolation
- [ ] Freemium tier (usage-limited) plus a paid tier via payment gateway integration
- [ ] i18n-ready architecture (see §9)
- [ ] Admin console for channel configuration, user/data management, subscription overrides, and exception-case channel linking (see §5.3)

### 5.2 Candidate Features (v1.x / v2 — prioritization pending)

- **Budgeting alerts**: proactive warnings as a category's spending approaches or exceeds its set budget (the budget-setting mechanism itself is MVP per §4.4; the *proactive alerting* on top of it is a candidate for v1.x).
- **Recurring transaction detection**: identify repeating patterns (e.g., subscriptions) and suggest auto-logging.
- **Voice note parsing**: transcription and extraction from voice notes (Workers AI provides speech-to-text).
- **Split transactions**: allocate a single receipt across multiple categories.
- **Client/project tagging**: allow freelancers to tag transactions to a client or project for separate tracking.
- **Anomaly-based proactive alerts**: e.g., "Spending in category X increased 40% compared to last month."
- **Referral program**: user-driven growth loop appropriate for an AI-as-a-service model.
- **Accountant-ready export**: structured data export for users who outgrow personal use.
- **Shared/group ledgers (future)**: explicitly out of scope for v1 per current product decision; noted here only as a potential future direction.

### 5.3 Admin Console (v1)

Built alongside the core bot, not deferred to a later phase. Access is gated by **Cloudflare Access** (SSO via allowlisted staff email addresses). Required capabilities:

- **Channel configuration & activation** — for each supported channel (WhatsApp, Telegram), admin enters connection configuration and triggers a **live validation test** (real connection/webhook check). A channel is marked active **only if validation passes** — there is no manual "just turn it on" toggle independent of validation. Actual credentials (API keys/bot tokens) are stored as **Cloudflare Workers Secrets**, never in D1; D1 stores only validation status and non-secret metadata (channel name, last validated timestamp, last check result).
- **Automatic periodic re-validation** — each active channel's configuration is re-checked on a **daily health-check cycle**. If a previously active channel starts failing validation (e.g., expired token, provider outage), its status flips to inactive automatically and is surfaced in the console, rather than silently continuing to appear active.
- **User management** — view, edit, and suspend user accounts.
- **Data/transaction oversight** — view and correct journal entries across users (for support/troubleshooting; all corrective actions are logged).
- **Subscription & billing management** — view Free/Paid status per user, apply manual overrides (e.g., comped access, refund-driven downgrade).
- **Exception-case channel linking** — for the rare case where a user cannot complete the self-service linking flow in §4.8 (e.g., total loss of access to all previously linked channels), staff can perform a manual linking action as a documented exception, not the default path.
- **Audit logging** — every admin action (channel config change, manual edit, subscription override, exception-case linking) is written to `admin_audit_log` with actor (staff email via Cloudflare Access), timestamp, and before/after state.

---

## 6. Data Model (High-Level)

Struku implements simplified **double-entry bookkeeping** for personal finance.

**Default chart of accounts** (auto-provisioned per user at onboarding):

- **Assets**: Cash, Bank Account(s), E-Wallet(s) — supports multiple asset accounts per user
- **Liabilities**: Credit Card, Personal Debt
- **Equity**: Opening Balance
- **Income**: Salary, Freelance Income, Other Income
- **Expenses**: Food, Transportation, Shopping, Bills & Utilities, Entertainment, Healthcare, Other (user-extensible)

**Core entities (indicative, not final schema):**

- `users` — canonical internal identity: profile, subscription tier, primary reporting currency, locale/language preference. Not tied to any single messaging channel.
- `channel_identities` — one row per (channel, external_id) pair linked to a `user_id` (e.g., `channel: telegram, external_id: <telegram_chat_id>` or `channel: whatsapp, external_id: <phone_number>`). **A user may have more than one simultaneously active channel identity**, enabling concurrent use of WhatsApp and Telegram on the same account.
- `channel_link_requests` — pending one-time codes generated by the self-service linking flow (§4.8): requesting user, target channel, code, expiry, status (pending/completed/expired).
- `channel_configs` — **platform-level** (not per-user) configuration for each supported channel: channel name, non-secret metadata, validation status, `last_validated_at`, `last_check_result`. Actual secrets (API keys/bot tokens) live in Cloudflare Workers Secrets, referenced by name/binding here, never stored as plaintext values in this table.
- `accounts` — chart of accounts per user (type: asset / liability / equity / income / expense; supports currency attribute per account)
- `journal_entries` — transaction header (date, description, source: image/text, status)
- `journal_lines` — debit/credit lines per entry (account_id, amount, currency, dr/cr)
- `attachments` — R2 references to source images, linked to journal_entries
- `categories` — user-facing category labels mapped to income/expense accounts
- `budgets` — per-category budget targets by period
- `exchange_rates` — reference rates used for multi-currency reporting/conversion; sourced from the **Frankfurter API** (free, ECB-based rates, no API key required) and refreshed on a **daily cache cycle** into D1 rather than fetched per-transaction
- `detail_view_tokens` — short-lived, single-use tokens for the read-only detailed transaction view (§4.7); intentionally lightweight compared to a full session model, since the view is read-only and narrowly scoped
- `admin_audit_log` — records every admin action with actor (staff email from Cloudflare Access), timestamp, and before/after state

Every transaction produces a minimum of two balanced journal lines (debit and credit), distinguishing Struku's ledger from a simple flat list of expenses.

**Currency model:** each user sets one **primary reporting currency** at onboarding (default: IDR). Transactions may be recorded in any currency; each `journal_line` retains its original transaction currency. Aggregated views (chat summaries, PDF reports, budget totals) automatically convert non-primary-currency amounts into the primary reporting currency using the daily-cached rate from `exchange_rates`, and indicate which rate/date was applied for transparency.

**Multi-channel model:** unlike a traditional single-login product, Struku's identity model assumes a user may be simultaneously reachable on more than one channel. All ledger, budget, and category data is keyed on the internal `user_id`; `channel_identities` is purely a routing/authentication layer on top of that shared identity.

---

## 7. Technical Architecture

| Layer | Technology | Notes |
|---|---|---|
| API / backend framework | **Hono** | Lightweight router, well-suited to the Workers runtime |
| Hosting | **Cloudflare Workers** | Serverless, edge-deployed |
| Database | **Cloudflare D1** | SQLite-based relational store for journal/ledger data and channel-config metadata |
| File storage | **Cloudflare R2** | Stores receipt/transfer-proof images and generated report PDFs |
| Secrets management | **Cloudflare Workers Secrets** | Stores channel API keys/bot tokens; never persisted in D1 |
| AI — image parsing | **Cloudflare Workers AI**, `@cf/meta/llama-3.2-11b-vision-instruct` | Vision-language model prompted for structured (JSON) extraction from receipt images |
| AI — text parsing | **Cloudflare Workers AI** text model (Llama 3.x instruct family, as available on Workers AI) | Used for transaction, budget, and category natural-language parsing |
| PDF generation | **pdf-lib** (pure JavaScript, no headless-browser dependency) | Generates monthly/ad-hoc report PDFs directly within the Workers runtime; chosen because it has no Node-specific or browser-rendering requirement, unlike typical HTML-to-PDF tools |
| Messaging channel — WhatsApp | **api.co.id** (Official WhatsApp Cloud API / Meta Tech Provider) | REST API over HTTPS with HMAC-signed webhooks for inbound message events |
| Messaging channel — Telegram | **Telegram Bot API** (official) | Free, webhook-based |
| Dashboard / detail view auth | **Short-lived, single-use tokens** (`detail_view_tokens`) | Not a persistent login session — scoped strictly to the read-only detail view (§4.7) |
| Admin console authentication | **Cloudflare Access** (SSO via allowlisted staff email) | No custom password/2FA system built |
| Payment processing | **Xendit** | Used for paid-tier subscription billing |

### 7.1 Multi-Channel Strategy (WhatsApp + Telegram, concurrently)

Struku is built against a **channel-agnostic messaging adapter interface** rather than coupling core logic directly to a specific provider's API shape. Both WhatsApp and Telegram are first-class, simultaneously supported channels.

- **Adapter interface**: a single internal interface (e.g., `MessagingProvider`) exposes provider-agnostic operations — `sendText`, `sendMediaPrompt`, `sendDocument` (for PDF report delivery), `receiveInboundMessage` (normalized to a common shape: text, image, document, sender ID, optional reply-to-message reference), and `sendLinkRequestCode`. All bot logic (parsing triggers, confirmation flows, budget/category commands, report delivery, channel linking) is written against this interface, never against Telegram- or WhatsApp-specific payloads directly.
- **Provider implementations**: `TelegramProvider` and `WhatsAppProvider`, each translating between the provider's native webhook/API format and the normalized internal message shape.
- **Activation gating**: a channel's `MessagingProvider` implementation is only wired to live traffic (webhook registered, inbound requests processed) when its corresponding `channel_configs` row is in a validated/active state, per the Admin Console flow in §5.3. An unconfigured or failed-validation channel receives no live routing.
- **Continuous validation**: the daily health-check cycle (§5.3) re-runs the same validation logic used at initial setup, so a channel that later breaks (expired token, provider-side change) is automatically flagged rather than silently remaining "active" while actually failing.
- **Concurrent multi-channel identity**: since `channel_identities` supports more than one simultaneously active row per `user_id` (§6), a user can freely move between WhatsApp and Telegram without any "switch" operation — both are just always-available entry points into the same account once linked.

**Note on WhatsApp provider integration:** api.co.id exposes a standard REST endpoint (`POST /api/v1/public/messages/send`) authenticated via bearer API key, and delivers inbound events (text, image, document, location) through HMAC-SHA256-signed webhooks. It also supports sending document-type media, which covers PDF report delivery (§4.6).

**Note on Telegram provider integration:** the Telegram Bot API delivers inbound updates via webhook in a JSON format structurally simple to normalize into the same internal message shape used by `WhatsAppProvider`, and natively supports both document sending (PDF reports) and reply-to-message context (useful for the chat-native edit flow in §4.5).

**Note on AI parsing accuracy:** OCR/extraction quality for Indonesian receipts (thermal paper, inconsistent formats, faded print) has not yet been validated against Struku's real-world input distribution. This should be tested early, since it directly determines how often users fall into the manual-entry fallback path (§4.2, step 5) versus the streamlined confirm-only path. This is independent of which messaging channel is active.

---

## 8. Monetization — Freemium Model

**Free tier:**
- Up to **20 transactions per week** as the initial value, implemented as a **configurable limit** (stored as config, not hardcoded) so it can be adjusted post-launch based on real usage data without a code deploy
- Unlimited transaction history retention (no retention cap on the Free tier)
- Chat-native budgeting, category management, and editing (§4.4–§4.5)
- Basic monthly report (PDF, delivered in chat)

**Paid tier:**
- Unlimited transactions
- Budgeting and threshold alerts (candidate feature, §5.2)
- Extended transaction history retention
- (Candidate) prioritized AI parsing throughput, additional asset accounts

*(Exact pricing and tier boundaries are to be finalized in a separate pricing document.)*

---

## 9. Internationalization (i18n)

The system will be built with i18n support from the outset, even though the initial launch market is Indonesian:

- All user-facing strings (bot replies, PDF report labels, detail-view UI) are to be externalized into locale resource files rather than hardcoded.
- `users.locale` determines bot response language, PDF report language, and detail-view language.
- Currency formatting, date formatting, and number formatting must be locale-aware (relevant given multi-currency support in §5.1 and §6).
- AI parsing prompts should be locale-parameterized where feasible, since transaction, budget, and category input may appear in more than one language over time.
- Initial supported locale: Indonesian (`id`). Architecture must not assume `id` as a hardcoded default at the data layer.

---

## 10. Non-Functional Requirements

- **Privacy and security**: financial data is sensitive; sensitive fields must be encrypted at rest. Channel credentials are never stored in D1 (Cloudflare Workers Secrets only). The read-only detail view relies exclusively on short-lived, single-use tokens — no persisted passwords or long-lived sessions.
- **Multi-tenant isolation**: all D1 queries must be scoped by `user_id`; no cross-user data access paths.
- **Bot responsiveness**: target end-to-end response time (including AI parsing) under approximately 5–10 seconds to maintain a conversational feel.
- **Messaging provider reliability**: each active channel's health is continuously monitored via the daily validation cycle (§5.3/§7.1); a channel that silently degrades must be automatically reflected as inactive, not left in a stale "active" state.
- **Ledger integrity**: double-entry validation must occur at the application layer before any commit to D1 — no unbalanced journal entries may be persisted.
- **Multi-currency correctness**: exchange rate handling must be explicit and auditable; reports must clearly indicate which currency each figure is denominated in, and how conversions (if any) were derived.
- **Chat-native command robustness**: since budget/category/edit actions accept both strict commands and natural language, the AI parser must handle ambiguous phrasing gracefully — including asking a clarifying question in chat rather than silently guessing when confidence is low.
- **Admin console access control**: admin access is gated by Cloudflare Access (staff email allowlist); every admin action affecting user data or channel configuration must be captured in `admin_audit_log` without exception.

---

## 11. Resolved Decisions (from stakeholder review)

| Topic | Decision |
|---|---|
| Product name | Struku |
| WhatsApp provider | api.co.id (Official WhatsApp Cloud API) |
| Free-tier transaction limit | 20 transactions/week, implemented as a **configurable** value, not hardcoded, pending post-launch usage validation |
| Multiple asset accounts per user | Supported in v1 |
| Failed image parsing behavior | Prompt user for manual input; on successful parsing, always request re-confirmation before committing |
| Internationalization | Built i18n-ready from v1, even though initial launch targets Indonesian only |
| Multi-currency support | Required — users may hold or transact in more than one currency |
| Currency reporting model | Primary reporting currency per user, with automatic conversion of other-currency transactions for aggregated views |
| Exchange rate source | Frankfurter API (free, ECB-based, no key), refreshed on a daily cache cycle into D1 |
| Free-tier data retention | Unlimited — no retention cap while the account remains active |
| **Messaging channel model** | **WhatsApp and Telegram active simultaneously**, each gated by validated configuration in the Admin Console |
| **Per-user channel linkage** | **A user may link and use multiple channels concurrently** for the same account |
| **Channel activation rule** | A channel is live for end users only if its configuration passes a live connection/webhook validation test in the Admin Console — no manual override to force-enable an unvalidated channel |
| **Channel config re-validation** | Automatic **daily health-check cycle** re-validates each active channel; failures automatically flip status to inactive |
| **Channel credential storage** | Stored as **Cloudflare Workers Secrets**; D1 stores only non-secret metadata and validation status |
| **Channel linking mechanism** | **Self-service, chat-native** (`/link` + one-time code exchanged between channels), not admin-mediated by default; admin-mediated linking is an exception path only (§4.8, §5.3) |
| **Product interaction model** | **Chat-first**: budgeting, category management, editing/reclassifying, and report requests all happen natively in chat; no general-purpose web dashboard |
| **Report delivery format** | Monthly/ad-hoc reports delivered as a **PDF file sent directly in chat**, not a link to a web page |
| **Command syntax** | Both strict slash-commands and natural-language phrasing are accepted for budget/category actions, parsed by the same AI text pipeline used for transactions |
| **Detailed transaction view** | Scoped narrowly to a filterable/searchable transaction list with receipt-image preview; triggered manually by explicit user request only, never auto-attached to reports; access via short-lived single-use link, not a persistent session |
| **PDF generation approach** | `pdf-lib` (pure JavaScript, Workers-compatible), avoiding headless-browser rendering dependencies |

---

## 12. Open Questions

None outstanding at this stage. All items from previous drafts have been resolved and recorded above.

---

## 13. Risks

- **Receipt OCR accuracy** — Indonesian thermal-paper receipts vary significantly in layout and legibility; parsing failure rate directly impacts UX quality via the manual-entry fallback rate.
- **Chat-native edit/reclassify ambiguity** — resolving *which* transaction a free-text correction refers to (§4.5) is inherently fuzzier than an explicit UI edit action; needs careful prompt design and a clear fallback ("did you mean this transaction?") to avoid silent misapplication of corrections.
- **Dual-channel maintenance overhead** — running two live provider integrations concurrently (rather than one at a time) increases the ongoing surface area for provider-side breaking changes, rate limits, and webhook format differences.
- **Channel-config staleness window** — since re-validation runs on a daily cycle rather than in real time, a channel can silently fail for up to ~24 hours before the Admin Console reflects it as inactive; this window should be weighed against the cost of more frequent checks.
- **PDF generation constraints in Workers runtime** — `pdf-lib` avoids headless-browser dependencies, but its layout capabilities are more limited than full HTML-to-PDF rendering; report design should stay within what's realistically achievable with a lower-level PDF library.
- **Provider-leakage risk** — without discipline, provider-specific message features (e.g., WhatsApp interactive buttons vs. Telegram inline keyboards/reply-to-message) can leak into core bot logic and quietly break the channel-agnostic adapter assumption in §7.1.
- **User trust in financial data handling** — given the sensitivity of the data, security posture and privacy communication require particular care from launch.