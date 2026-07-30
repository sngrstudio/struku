# Software Requirements Specification: Struku

**Document Type:** Software Requirements Specification (SRS)
**Standard Reference:** IEEE 830-1998 / ISO/IEC/IEEE 29148:2018
**Product Name:** Struku
**Document Status:** Draft v1
**Source Document:** Struku PRD, Draft v3
**Date:** July 31, 2026

---

## 1. Introduction

### 1.1 Purpose

This Software Requirements Specification (SRS) defines the functional and non-functional requirements for **Struku**, an AI-powered, chat-first personal finance bot operating over WhatsApp and Telegram. This document translates the product intent captured in the Struku Product Requirements Document (PRD, Draft v3) into precise, verifiable, implementation-ready requirements suitable for system design, development, and acceptance testing.

**Intended audience:**
- Software engineers and architects responsible for implementing the system (including AI-assisted development workflows)
- QA engineers designing test plans and acceptance criteria
- The product owner, for requirements traceability against the PRD
- Any future technical reviewer or auditor assessing system behavior, security posture, or regulatory compliance

### 1.2 Scope

**In scope**, the system described by this SRS SHALL provide:
- Chat-based transaction recording (image-based receipt/invoice/transfer-proof parsing and free-text natural-language input) over WhatsApp and Telegram, operating concurrently
- A double-entry bookkeeping engine underlying all recorded transactions
- Multi-currency transaction support with a per-user primary reporting currency
- Chat-native budget management, category management, and transaction editing/reclassification
- Automated generation and in-chat delivery of financial reports as PDF documents
- An on-demand, read-only, short-lived web view for detailed transaction inspection
- Self-service, chat-native linking of multiple messaging channels to a single user account
- A multi-tenant SaaS architecture with a freemium commercial model
- An internal Admin Console for channel configuration/validation, user management, transaction oversight, subscription management, and exception-case operations
- Internationalization (i18n) readiness at the architectural level, with Indonesian (`id`) as the initial supported locale

**Out of scope** for this version of the system:
- A general-purpose, full-featured web dashboard as a primary interface (the web surface is limited to the narrow read-only view in §3.9)
- Business/SME accounting features: invoicing, tax computation, VAT reporting, or multi-entity bookkeeping
- Shared, family, or group ledgers (single-user ledger ownership only)
- Direct bank account integration (open banking / account aggregation APIs)
- Team structure, staffing plans, or delivery timelines (organizational concerns outside the scope of a technical SRS)
- Candidate/future features enumerated in PRD §5.2 (budgeting alerts, recurring-transaction detection, voice note parsing, split transactions, client/project tagging, anomaly-based alerts, referral programs, accountant-ready export, shared ledgers) — these MAY inform future SRS revisions but SHALL NOT be treated as v1 requirements

### 1.3 Definitions, Acronyms, and Abbreviations

| Term | Definition |
|---|---|
| SRS | Software Requirements Specification |
| PRD | Product Requirements Document |
| FR | Functional Requirement |
| NFR | Non-Functional Requirement |
| MVP | Minimum Viable Product |
| D1 | Cloudflare D1, a managed SQLite-based relational database service |
| R2 | Cloudflare R2, an S3-compatible object storage service |
| Workers | Cloudflare Workers, a serverless edge-compute runtime |
| Workers AI | Cloudflare's managed inference platform for hosted AI models |
| Hono | A lightweight web framework used for the system's API/backend routing |
| OCR | Optical Character Recognition |
| NLP | Natural Language Processing |
| Double-entry bookkeeping | An accounting method in which every transaction is recorded as at least one debit and one credit entry, such that total debits equal total credits |
| Journal entry | A single recorded transaction event, composed of one or more balanced debit/credit journal lines |
| Chart of accounts | The structured list of accounts (asset, liability, equity, income, expense) against which journal lines are posted |
| Channel | A supported messaging platform through which the bot is reachable (WhatsApp or Telegram) |
| Channel identity | The association between a user's internal account and their external identifier on a specific channel (e.g., a phone number or a Telegram chat ID) |
| Primary reporting currency | The single currency in which a user's aggregated financial views (summaries, reports, budgets) are denominated, regardless of the currency in which individual transactions were recorded |
| Detail view token | A short-lived, single-use access token granting temporary access to the read-only transaction detail web view |
| Admin Console | The internally-facing management interface used by Struku staff, distinct from the end-user chat experience |
| Freemium | A commercial model in which a limited free tier coexists with a paid tier offering expanded functionality/limits |
| UU PDP | Undang-Undang Perlindungan Data Pribadi (Law No. 27 of 2022), Indonesia's Personal Data Protection Law |
| HMAC | Hash-based Message Authentication Code, used to verify webhook payload authenticity |
| SSO | Single Sign-On |
| Webhook | An HTTP callback mechanism by which a third-party messaging provider delivers inbound events to the system |

---

## 2. Overall Description

### 2.1 Product Perspective

Struku is a **new, standalone SaaS product** composed of a serverless backend and two external-facing surfaces: (1) conversational bot endpoints on WhatsApp and Telegram, and (2) a minimal read-only web view. It is not a component of a larger existing system, but it is **heavily dependent on third-party integrations**, specifically:

- **WhatsApp Cloud API**, accessed via the api.co.id gateway, for WhatsApp message delivery/receipt
- **Telegram Bot API**, for Telegram message delivery/receipt
- **Cloudflare Workers AI**, for image-based receipt parsing and natural-language text parsing
- **Frankfurter API**, for exchange rate data supporting multi-currency conversion
- **Xendit**, for payment processing supporting the paid subscription tier
- **Cloudflare Access**, for Admin Console authentication (SSO)

The system SHALL be architected so that its core domain logic (ledger posting, budget evaluation, category resolution) is decoupled from any single messaging provider's API shape, via a channel-agnostic messaging adapter layer (see §5.2, FR-CH).

### 2.2 User Classes and Characteristics

| User Class | Description | Access Level |
|---|---|---|
| **End User** | A consumer using Struku via WhatsApp and/or Telegram to record and review personal finances | Access limited to their own data, scoped by `user_id`. No direct data access outside the chat interface and their own short-lived detail-view links. |
| **Free-Tier End User** | An End User on the unpaid subscription tier | Subject to a configurable weekly transaction limit (default: 20/week); full access to chat-native budgeting, categorization, and editing; basic PDF reports. |
| **Paid-Tier End User** | An End User on the paid subscription tier | No transaction limit; access to extended history retention and prioritized processing where applicable. |
| **Internal Staff (Admin)** | Struku personnel operating the Admin Console | Authenticated via Cloudflare Access (SSO). Authorized to configure messaging channels, manage user accounts, correct ledger data, override subscription state, and perform exception-case channel relinking. All actions are audit-logged. |

End users are assumed to have no technical background; the system MUST NOT require them to understand accounting terminology, channel configuration, or any concept beyond "send a photo or type what you spent."

### 2.3 Operating Environment

- **Backend runtime:** Cloudflare Workers (V8 isolate-based serverless edge runtime); no assumption of a persistent server process or specific OS.
- **Database:** Cloudflare D1 (SQLite-compatible), accessed exclusively through the Workers runtime.
- **Object storage:** Cloudflare R2, for receipt images, transfer-proof images, and generated PDF reports.
- **Client environment (End User):** any device capable of running the WhatsApp or Telegram mobile/desktop client; the system SHALL NOT require End Users to install any Struku-specific application.
- **Client environment (Detail View):** any modern mobile or desktop web browser supporting standard HTML/CSS/JS rendering; the view SHALL be responsive and MUST render correctly on mobile viewport widths, since it will typically be opened from a chat-embedded link on a phone.
- **Client environment (Admin Console):** a modern desktop web browser, accessed only by authenticated internal staff via Cloudflare Access.

### 2.4 Design and Implementation Constraints

- The backend API layer SHALL be implemented using **Hono**.
- The system SHALL be deployed on **Cloudflare Workers**; implementation MUST NOT rely on Node.js-specific APIs unavailable in the Workers runtime.
- Relational data SHALL be persisted in **Cloudflare D1**.
- Binary assets (images, generated PDFs) SHALL be persisted in **Cloudflare R2**, not in D1.
- All channel credentials (WhatsApp API keys, Telegram bot tokens) SHALL be stored exclusively as **Cloudflare Workers Secrets**; they MUST NOT be persisted as plaintext values in D1 or any other application-layer datastore.
- PDF report generation SHALL use **`pdf-lib`** (a pure-JavaScript library with no headless-browser or Node-native dependency), consistent with Workers runtime constraints.
- AI-based parsing (image and text) SHALL use models hosted on **Cloudflare Workers AI**, specifically a vision-language model (e.g., `@cf/meta/llama-3.2-11b-vision-instruct`) for image parsing and a Llama 3.x instruct-family text model for natural-language parsing.
- Exchange rate data SHALL be sourced from the **Frankfurter API** and cached on a daily refresh cycle; the system MUST NOT call the exchange-rate API on a per-transaction basis.
- Admin Console authentication SHALL use **Cloudflare Access**; the system MUST NOT implement a custom username/password or 2FA mechanism for internal staff.
- Payment processing for the paid tier SHALL integrate with **Xendit**.
- The system SHALL comply with **UU PDP (Law No. 27/2022)** as the governing data protection regulation, given that personal and financial data of Indonesian data subjects is processed (see §4.2).
- The system SHALL be designed for a target availability of **99.5%** (see §4.3).

---

## 3. System Features & Functional Requirements

### 3.1 Transaction Recording via Receipt/Invoice/Transfer-Proof Image

#### 3.1.1 Description & Priority

Allows an End User to record a financial transaction by sending a photo of a receipt, invoice, or transfer confirmation to any active, linked channel. The system extracts structured transaction data via AI and posts a balanced journal entry upon confirmation.
**Priority:** High (MVP)

#### 3.1.2 Preconditions & Postconditions

- **Preconditions:** The sending channel is active and validated (§3.10); the sender has a provisioned `user_id` (or is completing onboarding, §3.12); the image is a supported format and within size limits.
- **Postconditions:** On confirmation, a balanced `journal_entries`/`journal_lines` record exists, linked to an `attachments` record referencing the stored image in R2. On failure or discard, no journal entry is created.

#### 3.1.3 Functional Requirements

- FR-IMG-01: The system SHALL accept image messages (JPEG, PNG, and WebP at minimum) sent by an End User on any active channel.
- FR-IMG-02: The system SHALL upload the received image to R2 prior to invoking AI parsing, and SHALL retain the R2 reference regardless of parsing outcome.
- FR-IMG-03: The system SHALL invoke the configured Workers AI vision model to extract, at minimum: merchant/counterparty name, transaction amount, currency, transaction date, and a suggested category.
- FR-IMG-04: Upon successful extraction, the system SHALL reply to the user with a structured, human-readable summary of the extracted fields and SHALL present explicit confirm, edit, and discard actions.
- FR-IMG-05: The system SHALL NOT commit a journal entry to D1 until the user has explicitly confirmed the transaction.
- FR-IMG-06: Upon confirmation, the system SHALL generate a minimum of two balanced (debit = credit) `journal_lines` under a single `journal_entries` record and persist them atomically.
- FR-IMG-07: If the user selects "Edit," the system SHALL allow modification of any extracted field prior to commit, via chat-native input (see §3.7 for the general editing mechanism).
- FR-IMG-08: If the user selects "Discard," the system SHALL discard the parsed data and SHALL NOT create any journal entry, while retaining the uploaded image reference for a bounded period for audit/debugging purposes.

#### 3.1.4 Error Handling & Edge Cases

- EC-IMG-01: If the AI model returns low-confidence or incomplete extraction (e.g., unreadable thermal-paper receipt), the system SHALL inform the user that automatic parsing failed and SHALL prompt for manual entry of the transaction fields, rather than retrying parsing automatically.
- EC-IMG-02: If the image format is unsupported or exceeds the maximum allowed size, the system SHALL reject the upload with a clear, non-technical error message and SHALL NOT attempt AI parsing.
- EC-IMG-03: If R2 upload fails, the system SHALL NOT proceed to AI parsing and SHALL inform the user that the image could not be processed, inviting a retry.
- EC-IMG-04: If the extracted currency is not a currency the system recognizes/supports, the system SHALL flag this to the user during the confirmation step rather than silently defaulting to the primary reporting currency.
- EC-IMG-05: If the user does not respond to a pending confirmation within a defined timeout period, the system SHOULD expire the pending transaction and MAY notify the user that the draft was discarded.

---

### 3.2 Transaction Recording via Free-Text Natural-Language Input

#### 3.2.1 Description & Priority

Allows an End User to record a transaction by typing a natural-language message (e.g., "bought coffee 25k"), parsed via AI into structured transaction data.
**Priority:** High (MVP)

#### 3.2.2 Preconditions & Postconditions

- **Preconditions:** The sending channel is active; the message is plausibly a transaction-recording intent (as opposed to a query, budget command, or category command — see §3.5–§3.7).
- **Postconditions:** On confirmation, a balanced journal entry exists as in §3.1.3.

#### 3.2.3 Functional Requirements

- FR-TXT-01: The system SHALL parse free-text messages using the configured Workers AI text model to extract: transaction type (income/expense), amount, currency, category, and date.
- FR-TXT-02: If no date is specified in the message, the system SHALL default the transaction date to the current date at the time of message receipt, in the user's configured timezone.
- FR-TXT-03: The system SHALL present the parsed result for confirmation using the same confirm/edit/discard pattern defined in FR-IMG-04–FR-IMG-08.
- FR-TXT-04: The system SHALL disambiguate transaction-recording intent from budget-setting, category-management, and editing intent (§3.5–§3.7) using the same underlying NLP pipeline, routing the message to the correct handler.

#### 3.2.4 Error Handling & Edge Cases

- EC-TXT-01: If the message is too ambiguous to extract a transaction type, amount, or category with sufficient confidence, the system SHALL ask a clarifying question in chat rather than guessing silently.
- EC-TXT-02: If the amount is stated in an ambiguous shorthand (e.g., regional abbreviations for thousands/millions), the system SHALL resolve it using locale-aware parsing rules (see §9 of the PRD; §3.14 of this SRS) and SHALL surface the resolved absolute value at confirmation so the user can catch misinterpretation.
- EC-TXT-03: If the parsed intent conflicts with an active pending confirmation from a prior message, the system SHALL treat the new message as a new draft rather than silently overwriting the pending one, unless the message is clearly a correction to the pending draft.

---

### 3.3 Double-Entry Journaling Engine

#### 3.3.1 Description & Priority

The core ledger engine underlying all transaction recording, ensuring every financial event is represented as balanced debit/credit postings against a chart of accounts.
**Priority:** High (MVP)

#### 3.3.2 Preconditions & Postconditions

- **Preconditions:** A user account with a provisioned default chart of accounts exists.
- **Postconditions:** All committed transactions are internally consistent: for every `journal_entries` record, the sum of associated `journal_lines` debits equals the sum of credits.

#### 3.3.3 Functional Requirements

- FR-LDG-01: The system SHALL auto-provision a default chart of accounts for each new user at onboarding, covering Assets, Liabilities, Equity, Income, and Expense account types.
- FR-LDG-02: The system SHALL allow users to extend the default Expense category set with user-defined categories (see §3.6), each mapped to an underlying `accounts` record.
- FR-LDG-03: The system SHALL reject (at the application layer, prior to any D1 write) any attempted journal entry commit where the sum of debit amounts does not equal the sum of credit amounts within the same currency context.
- FR-LDG-04: The system SHALL support multiple simultaneous Asset accounts per user (e.g., distinct cash, bank, and e-wallet balances).
- FR-LDG-05: Corrections to previously posted entries (§3.7) SHALL be implemented as either an update to the original entry (with audit trail) or a reversing entry plus a new entry, such that the ledger's balance integrity is never violated at any point in its history.

#### 3.3.4 Error Handling & Edge Cases

- EC-LDG-01: If a journal-entry commit would violate double-entry balance due to a rounding discrepancy across currencies, the system SHALL apply a documented rounding rule (e.g., round to the smallest currency unit on the primary reporting currency side) rather than silently dropping the discrepancy.
- EC-LDG-02: If a concurrent write conflict occurs on the same user's ledger (e.g., two near-simultaneous confirmations), the system SHALL serialize the writes such that both are correctly posted and no entry is lost or duplicated.

---

### 3.4 Multi-Currency Accounting

#### 3.4.1 Description & Priority

Enables transactions in currencies other than a user's primary reporting currency, with automatic conversion for aggregated views.
**Priority:** High (MVP)

#### 3.4.2 Preconditions & Postconditions

- **Preconditions:** The user has a defined primary reporting currency (set at onboarding, default IDR); current exchange rates are available in the daily cache.
- **Postconditions:** Each `journal_line` retains its original transaction currency; aggregated views correctly reflect converted totals with transparent rate attribution.

#### 3.4.3 Functional Requirements

- FR-CUR-01: The system SHALL allow each user to set exactly one primary reporting currency at onboarding, defaulting to IDR if not specified.
- FR-CUR-02: The system SHALL allow individual transactions to be recorded in any supported currency, independent of the user's primary reporting currency.
- FR-CUR-03: The system SHALL refresh exchange rate data from the Frankfurter API on a daily cache cycle and persist the cached rates in D1.
- FR-CUR-04: The system SHALL NOT call the exchange-rate API synchronously during individual transaction processing; conversion for aggregated views SHALL use the most recent cached rate.
- FR-CUR-05: All aggregated views (chat summaries, PDF reports, budget evaluations) SHALL display amounts converted into the primary reporting currency, and SHALL indicate which exchange rate/date was applied.
- FR-CUR-06: The system SHALL format currency amounts according to the user's configured locale (see §9 of the PRD).

#### 3.4.4 Error Handling & Edge Cases

- EC-CUR-01: If the Frankfurter API is unreachable during the scheduled daily refresh, the system SHALL continue using the last successfully cached rate and SHOULD flag the rate's staleness if it exceeds a defined threshold (e.g., more than 48 hours old).
- EC-CUR-02: If a transaction is recorded in a currency for which no exchange rate is available, the system SHALL surface this to the user at confirmation time rather than silently omitting it from converted aggregates.

---

### 3.5 Chat-Native Budget Management

#### 3.5.1 Description & Priority

Allows End Users to set and adjust per-category budget targets entirely within chat, using strict commands or natural language.
**Priority:** High (MVP)

#### 3.5.2 Preconditions & Postconditions

- **Preconditions:** The referenced category exists (or is created inline, see §3.6); the user is on an active channel.
- **Postconditions:** A `budgets` record exists or is updated for the specified category and period, and the bot has confirmed the resulting state back to the user.

#### 3.5.3 Functional Requirements

- FR-BUD-01: The system SHALL accept budget-setting requests expressed either as a strict slash-command (e.g., `/budget food 500000`) or as natural language (e.g., "set budget makan 500rb"), parsed by the same AI text pipeline used for transaction recording.
- FR-BUD-02: The system SHALL confirm the resulting budget state (category, amount, currency, period) back to the user in chat upon successful update.
- FR-BUD-03: The system SHALL support querying current budget status via chat (e.g., "remaining budget for shopping").
- FR-BUD-04: Budget amounts SHALL be denominated in the user's primary reporting currency unless the user explicitly specifies otherwise.

#### 3.5.4 Error Handling & Edge Cases

- EC-BUD-01: If the referenced category does not exist and cannot be confidently inferred, the system SHALL ask the user whether to create a new category or select an existing one, rather than silently creating a duplicate/misspelled category.
- EC-BUD-02: If a budget-setting message is ambiguous between a budget command and a transaction record (e.g., could be parsed either way), the system SHALL apply intent-disambiguation logic (FR-TXT-04) and, if confidence remains low, SHALL ask for clarification.

---

### 3.6 Chat-Native Category Management

#### 3.6.1 Description & Priority

Allows End Users to create and manage custom transaction categories entirely within chat.
**Priority:** High (MVP)

#### 3.6.2 Preconditions & Postconditions

- **Preconditions:** None beyond an active channel and a provisioned user account.
- **Postconditions:** A `categories` record exists, mapped to an underlying income/expense `accounts` record.

#### 3.6.3 Functional Requirements

- FR-CAT-01: The system SHALL accept category creation/edit requests via strict command (e.g., `/category add Monthly Groceries`) or natural language (e.g., "tambah kategori Belanja Bulanan").
- FR-CAT-02: The system SHALL prevent creation of duplicate categories (case-insensitive, locale-aware comparison) for the same user, offering to reuse the existing category instead.
- FR-CAT-03: The system SHALL confirm category creation/edits back to the user in chat.

#### 3.6.4 Error Handling & Edge Cases

- EC-CAT-01: If a user attempts to delete or rename a category with existing linked transactions, the system SHALL preserve historical journal-entry integrity (e.g., by retaining the category reference or requiring reassignment) rather than orphaning existing entries.

---

### 3.7 Chat-Native Transaction Editing & Reclassification

#### 3.7.1 Description & Priority

Allows End Users to correct or reclassify previously recorded transactions without leaving the chat interface.
**Priority:** High (MVP)

#### 3.7.2 Preconditions & Postconditions

- **Preconditions:** A target journal entry exists and is resolvable from context (reply-to-message reference, or recency/description matching).
- **Postconditions:** The target entry is updated (or reversed and re-posted) in a manner that preserves auditability and ledger balance (per FR-LDG-05).

#### 3.7.3 Functional Requirements

- FR-EDT-01: The system SHALL support transaction correction via reply-to-message context on channels that provide it (Telegram natively; WhatsApp via `context.id` where supported by the provider).
- FR-EDT-02: On channels or scenarios where reply-to-message context is unavailable, the system SHALL resolve the target transaction via recency and description matching, and SHALL explicitly confirm the resolved target with the user before applying any change.
- FR-EDT-03: The system SHALL support correction of any transaction field (amount, currency, date, category, counterparty).
- FR-EDT-04: The system SHALL require explicit user confirmation before committing any correction.
- FR-EDT-05: All corrections SHALL be reflected in `journal_entries`/`journal_lines` in a manner that maintains a complete audit trail of the original and corrected state.

#### 3.7.4 Error Handling & Edge Cases

- EC-EDT-01: If the system cannot resolve which transaction is being referenced with sufficient confidence, it SHALL explicitly ask "did you mean this transaction?" with enough context (amount, date, merchant) for the user to confirm, rather than guessing.
- EC-EDT-02: If a correction would cause the entry to become unbalanced, the system SHALL reject the commit and SHALL surface the imbalance to the user for resolution.
- EC-EDT-03: If the referenced transaction is older than the Free-tier's effective operational window (see §3.13) but retention is unlimited, the system SHALL still allow editing, since retention and editability are not coupled to a rolling window in this design.

---

### 3.8 Reporting (PDF Generation & In-Chat Delivery)

#### 3.8.1 Description & Priority

Generates and delivers monthly and ad-hoc financial reports as PDF documents sent directly within the chat conversation.
**Priority:** High (MVP)

#### 3.8.2 Preconditions & Postconditions

- **Preconditions:** The requesting channel supports document-type message delivery (both WhatsApp via api.co.id and Telegram support this).
- **Postconditions:** A PDF report is generated, stored in R2, and delivered as a document message to the requesting channel.

#### 3.8.3 Functional Requirements

- FR-RPT-01: The system SHALL respond to ad-hoc natural-language report/summary queries (e.g., "this month's report," "how much did I spend on food this week") with a concise text summary in chat.
- FR-RPT-02: For full monthly (or explicitly requested ad-hoc) reports, the system SHALL generate a PDF document using `pdf-lib` and SHALL deliver it as a document attachment directly within the chat conversation, not as a link to an external page.
- FR-RPT-03: The system SHALL support opt-in recurring (weekly/monthly) report delivery, proactively initiated by the system on the configured schedule.
- FR-RPT-04: Generated PDF reports SHALL reflect amounts in the user's primary reporting currency, with source-currency detail and applied exchange rate/date where conversions occurred (per FR-CUR-05).
- FR-RPT-05: Generated PDF reports and associated summary text SHALL be rendered in the user's configured locale (see §9 of the PRD).

#### 3.8.4 Error Handling & Edge Cases

- EC-RPT-01: If PDF generation fails (e.g., due to a `pdf-lib` layout constraint or unexpected data volume), the system SHALL fall back to delivering the text summary and SHALL inform the user that the PDF could not be generated, rather than failing silently.
- EC-RPT-02: If the requesting channel is temporarily unable to accept document-type messages, the system SHOULD retry delivery and, upon repeated failure, SHALL notify the user via a text message.
- EC-RPT-03: If a user has no transactions in the requested period, the system SHALL generate a report/summary explicitly stating this rather than an empty or malformed document.

---

### 3.9 On-Demand Detailed Transaction View (Read-Only Web View)

#### 3.9.1 Description & Priority

Provides a narrowly scoped, read-only web view of detailed transaction data, accessible only via an explicit, manually triggered request and a short-lived single-use link.
**Priority:** High (MVP)

#### 3.9.2 Preconditions & Postconditions

- **Preconditions:** The user has explicitly requested detail (e.g., "tampilkan rincian pengeluaran bulan ini," or a `/details` command); a `detail_view_tokens` record can be generated for the corresponding query scope.
- **Postconditions:** The token is single-use and expires after a short, defined window or after first successful access, whichever comes first.

#### 3.9.3 Functional Requirements

- FR-DTL-01: The system SHALL generate the detail view link **only** in direct response to an explicit user request; it SHALL NOT be auto-attached to every report or summary message (per PRD §4.7, step 2).
- FR-DTL-02: The detail view SHALL present a filterable/searchable list of the transactions matching the scope of the triggering request (e.g., "this month's expenses"), including receipt/attachment image previews per transaction.
- FR-DTL-03: The detail view SHALL be strictly read-only; it SHALL NOT expose editing, budget/category management, or account-settings functionality.
- FR-DTL-04: Access to the detail view SHALL be governed by a `detail_view_tokens` record that is single-use and time-limited; the system SHALL NOT implement a persistent, reusable login session for this surface.
- FR-DTL-05: The detail view SHALL be responsive and render correctly on mobile browser viewports, given it is expected to be opened primarily from a mobile chat client.

#### 3.9.4 Error Handling & Edge Cases

- EC-DTL-01: If a detail view token is expired or already used, the system SHALL present a clear "link expired" state and SHALL instruct the user to request a new link via chat, rather than exposing a generic error.
- EC-DTL-02: If the underlying transaction data changes between token generation and access (e.g., a transaction was edited via chat in the interim), the view SHALL reflect the current state at access time, not a stale snapshot.
- EC-DTL-03: The system SHALL ensure that a detail view token cannot be used to access another user's data under any circumstance, including via token guessing or replay.

---

### 3.10 Multi-Channel Messaging Support (WhatsApp + Telegram, Concurrent)

#### 3.10.1 Description & Priority

Provides simultaneous, first-class support for both WhatsApp and Telegram as messaging channels, via a channel-agnostic adapter layer, with per-channel activation gated by validated Admin Console configuration.
**Priority:** High (MVP)

#### 3.10.2 Preconditions & Postconditions

- **Preconditions:** A `channel_configs` record exists for the channel and has passed validation (§3.14).
- **Postconditions:** Inbound/outbound traffic for the channel is routed through the corresponding provider implementation without leaking provider-specific payload shapes into core business logic.

#### 3.10.3 Functional Requirements

- FR-CH-01: The system SHALL define a channel-agnostic `MessagingProvider` interface exposing, at minimum: `sendText`, `sendMediaPrompt`, `sendDocument`, `receiveInboundMessage` (normalized), and `sendLinkRequestCode`.
- FR-CH-02: The system SHALL implement `TelegramProvider` and `WhatsAppProvider` as concrete implementations of `MessagingProvider`, each responsible solely for translating between the provider-native format and the normalized internal message shape.
- FR-CH-03: All bot business logic (parsing, confirmation flows, budgeting, editing, reporting, linking) SHALL be implemented exclusively against the `MessagingProvider` interface, and SHALL NOT reference provider-specific payload fields directly.
- FR-CH-04: A channel's live webhook routing SHALL be enabled if and only if its `channel_configs` record is in a validated/active state, as determined by the Admin Console (§3.14).
- FR-CH-05: The system SHALL support a single user account being reachable and operable via more than one simultaneously active channel (§3.11), with all channels routing to the same `user_id`-scoped data.

#### 3.10.4 Error Handling & Edge Cases

- EC-CH-01: If an inbound webhook is received for a channel whose `channel_configs` status is inactive/unvalidated, the system SHALL reject or ignore the request rather than processing it as if the channel were live.
- EC-CH-02: If a provider's webhook payload format changes in a way the corresponding provider implementation cannot parse, the system SHALL log the failure without crashing the shared adapter interface or affecting the other channel's operation.
- EC-CH-03: The system SHALL treat provider-specific interactive features (e.g., WhatsApp buttons, Telegram inline keyboards) as optional enhancements layered on top of the normalized interface, never as a required dependency of core flows, to prevent provider-leakage into business logic (per PRD §13 risk).

---

### 3.11 Self-Service Multi-Channel Linking

#### 3.11.1 Description & Priority

Allows an End User to link an additional messaging channel to their existing account entirely within chat, via a one-time code exchange, without administrator involvement in the routine case.
**Priority:** High (MVP)

#### 3.11.2 Preconditions & Postconditions

- **Preconditions:** The user has at least one already-linked, active channel identity; the target channel is active per §3.10.
- **Postconditions:** A new `channel_identities` record is created and linked to the existing `user_id`; both channels are usable interchangeably thereafter.

#### 3.11.3 Functional Requirements

- FR-LNK-01: The system SHALL accept a link request from an already-linked channel (e.g., `/link whatsapp` or "connect my WhatsApp"), targeting a specific channel.
- FR-LNK-02: The system SHALL generate a short-lived, single-use `channel_link_requests` code and instruct the user to submit it from the target channel.
- FR-LNK-03: The system SHALL reject a link request targeting a channel that is not currently active per §3.10 (FR-CH-04).
- FR-LNK-04: Upon receiving a matching code from the target channel, the system SHALL create a new active `channel_identities` record for the same `user_id` and SHALL confirm success to the user on both channels where feasible.
- FR-LNK-05: The system SHALL allow the resulting multiple active channel identities to be used interchangeably for all subsequent operations (recording, budgeting, editing, reporting).

#### 3.11.4 Error Handling & Edge Cases

- EC-LNK-01: If the submitted code is expired, already used, or does not match any pending request, the system SHALL reject the linking attempt with a clear message and SHALL NOT create a partial or orphaned `channel_identities` record.
- EC-LNK-02: If a user attempts to link a channel identity that is already linked to a different existing `user_id`, the system SHALL reject the operation and SHALL surface this conflict rather than silently reassigning ownership.
- EC-LNK-03: If a user loses access to all previously linked channels and cannot complete the code exchange, the system SHALL direct them to a documented support path handled via the Admin Console exception process (§3.15, FR-ADM-06).

---

### 3.12 Multi-Tenant Onboarding & Account Provisioning

#### 3.12.1 Description & Priority

Provisions a new, isolated user account upon first contact from an unrecognized channel identity.
**Priority:** High (MVP)

#### 3.12.2 Preconditions & Postconditions

- **Preconditions:** An inbound message arrives from a channel identity not yet associated with any `user_id`, on an active channel.
- **Postconditions:** A new `users` record and an initial `channel_identities` record exist; a default chart of accounts is provisioned; the account is on the Free tier.

#### 3.12.3 Functional Requirements

- FR-ONB-01: The system SHALL detect first contact from an unrecognized channel identity and SHALL initiate the onboarding flow rather than treating the message as a transaction/command.
- FR-ONB-02: The system SHALL present a welcome message and a link to a consent/Terms of Service notice before collecting further preferences.
- FR-ONB-03: The system SHALL collect, at minimum: display name, primary reporting currency (default IDR), timezone (default WIB), and language preference.
- FR-ONB-04: The system SHALL provision the default chart of accounts (per FR-LDG-01) as part of onboarding completion.
- FR-ONB-05: The system SHALL enforce strict data isolation per `user_id` across all subsequent operations, such that no cross-user data access is possible through any code path.

#### 3.12.4 Error Handling & Edge Cases

- EC-ONB-01: If a user abandons onboarding partway through, the system SHALL preserve the partial state and SHALL resume from the last completed step on the user's next message, rather than restarting from scratch or leaving an inconsistent partial account.
- EC-ONB-02: If onboarding is attempted on a channel that becomes inactive (fails validation) mid-flow, the system SHALL handle this gracefully and SHOULD allow resumption once the channel is active again or via another active channel.

---

### 3.13 Freemium Subscription & Usage Limits

#### 3.13.1 Description & Priority

Enforces a configurable Free-tier transaction limit and manages the transition to a Paid tier via Xendit.
**Priority:** High (MVP)

#### 3.13.2 Preconditions & Postconditions

- **Preconditions:** The user's subscription tier and current-period transaction count are tracked per account.
- **Postconditions:** Free-tier users exceeding the configured limit are prevented from recording further transactions until the period resets or they upgrade; Paid-tier users are unrestricted.

#### 3.13.3 Functional Requirements

- FR-SUB-01: The system SHALL enforce a configurable weekly transaction limit for Free-tier users, with an initial default of 20 transactions/week, stored as configuration rather than hardcoded.
- FR-SUB-02: The system SHALL NOT cap transaction history retention for Free-tier users (unlimited retention, per PRD §11).
- FR-SUB-03: The system SHALL integrate with Xendit to process paid-tier subscription payments and SHALL update the user's subscription tier upon confirmed payment.
- FR-SUB-04: The system SHALL notify Free-tier users in chat when they approach or reach their transaction limit, with guidance on upgrading.

#### 3.13.4 Error Handling & Edge Cases

- EC-SUB-01: If a Free-tier user attempts to record a transaction after reaching the limit, the system SHALL decline the recording action with a clear explanation and an upgrade path, rather than silently dropping the message.
- EC-SUB-02: If a Xendit payment webhook is delayed or fails, the system SHALL NOT prematurely downgrade or upgrade a user's tier based on incomplete information, and SHOULD reconcile subscription state via a periodic verification job.
- EC-SUB-03: If the configurable limit is changed by an administrator mid-period, the system SHALL apply the new limit prospectively and SHALL NOT retroactively penalize usage already recorded under the previous limit.

---

### 3.14 Admin Console — Channel Configuration & Validation

#### 3.14.1 Description & Priority

Enables internal staff to configure, validate, and continuously monitor the WhatsApp and Telegram channel integrations, with activation strictly gated by validation outcome.
**Priority:** High (MVP)

#### 3.14.2 Preconditions & Postconditions

- **Preconditions:** The staff member is authenticated via Cloudflare Access.
- **Postconditions:** A `channel_configs` record accurately reflects the current validation state of the channel at all times, refreshed at least daily.

#### 3.14.3 Functional Requirements

- FR-ADM-01: The system SHALL allow authenticated staff to enter channel configuration referencing the relevant Cloudflare Workers Secret binding, without ever displaying or storing the raw secret value in D1.
- FR-ADM-02: Upon configuration save, the system SHALL trigger a live connection/webhook validation test against the target provider before marking the channel active.
- FR-ADM-03: The system SHALL mark a channel active if and only if the validation test passes; there SHALL be no administrative override to force-activate a channel that has failed validation.
- FR-ADM-04: The system SHALL automatically re-run channel validation on a daily health-check cycle for every currently active channel.
- FR-ADM-05: If a previously active channel fails a re-validation check, the system SHALL automatically transition its status to inactive and SHALL surface this change prominently in the Admin Console.
- FR-ADM-06: The system SHALL allow staff to perform exception-case channel relinking for users who cannot complete the self-service flow (§3.11), and SHALL record this action in `admin_audit_log`.

#### 3.14.4 Error Handling & Edge Cases

- EC-ADM-01: If the validation test itself fails due to a transient network issue rather than an actual credential/configuration problem, the system SHOULD distinguish this in the reported status where feasible (e.g., "validation inconclusive, retrying") rather than immediately reporting a hard failure.
- EC-ADM-02: If both channels are simultaneously inactive (e.g., due to concurrent provider outages), the system SHALL continue to queue/reject inbound traffic safely without data loss for messages that do arrive through any partially functioning path, and SHALL surface this critical state prominently to staff.
- EC-ADM-03: The daily validation cycle SHALL NOT be treated as real-time monitoring; the system SHALL document the resulting detection latency (up to ~24 hours) as a known operational characteristic (see PRD §13).

---

### 3.15 Admin Console — User, Data, Subscription Management & Audit Logging

#### 3.15.1 Description & Priority

Provides internal staff with user account management, ledger data oversight, subscription override capability, and comprehensive audit logging of all administrative actions.
**Priority:** High (MVP)

#### 3.15.2 Preconditions & Postconditions

- **Preconditions:** The staff member is authenticated via Cloudflare Access.
- **Postconditions:** Every administrative action affecting user data, channel configuration, or subscription state is recorded in `admin_audit_log` with actor, timestamp, and before/after state.

#### 3.15.3 Functional Requirements

- FR-ADM-07: The system SHALL allow authenticated staff to view, edit, and suspend End User accounts.
- FR-ADM-08: The system SHALL allow authenticated staff to view and correct `journal_entries`/`journal_lines` across users for support/troubleshooting purposes.
- FR-ADM-09: The system SHALL allow authenticated staff to view subscription/billing status per user and apply manual overrides (e.g., comped access, refund-driven downgrade).
- FR-ADM-10: The system SHALL log every administrative action without exception to `admin_audit_log`, capturing actor identity (staff email via Cloudflare Access), timestamp, action type, and before/after state of the affected record.
- FR-ADM-11: The system SHALL restrict Admin Console access exclusively to staff email addresses present on the Cloudflare Access allowlist; no other authentication path SHALL exist for this surface.

#### 3.15.4 Error Handling & Edge Cases

- EC-ADM-04: If an admin correction to a journal entry would violate double-entry balance (FR-LDG-03), the system SHALL enforce the same balance validation as end-user-facing edits and SHALL reject the unbalanced commit.
- EC-ADM-05: If a staff member's Cloudflare Access authorization is revoked mid-session, the system SHALL terminate console access at the next request rather than honoring a previously established session indefinitely.

---

## 4. Non-Functional Requirements (NFR)

### 4.1 Performance Requirements

- NFR-PERF-01: The system SHALL respond to standard chat interactions (text parsing, confirmation flows) within an end-to-end target of 5–10 seconds under normal load.
- NFR-PERF-02: Image-based parsing (§3.1) MAY exceed the text-response target given AI vision-model inference time, but SHOULD complete within a defined upper bound (target: under 15 seconds) to preserve conversational feel.
- NFR-PERF-03: The system SHALL be designed to handle concurrent inbound traffic from both channels without cross-channel head-of-line blocking, leveraging the inherent concurrency model of the Cloudflare Workers runtime.
- NFR-PERF-04: PDF report generation SHALL complete within a bounded time appropriate for synchronous chat delivery (target: under 10 seconds for a typical monthly report); reports exceeding this SHOULD be generated asynchronously with a follow-up delivery message.
- NFR-PERF-05: Exchange rate lookups for aggregated views SHALL be served from the daily D1 cache (FR-CUR-04) and SHALL NOT introduce external API latency into the request path.

### 4.2 Security Requirements

- NFR-SEC-01: All data in transit between the system and third-party providers (WhatsApp/api.co.id, Telegram, Workers AI, Frankfurter, Xendit) SHALL be encrypted using TLS.
- NFR-SEC-02: All inbound webhook payloads from messaging providers SHALL be verified using the provider's signature mechanism (e.g., HMAC-SHA256 for the api.co.id/WhatsApp integration) before being processed; unverified payloads SHALL be rejected.
- NFR-SEC-03: Sensitive financial data fields SHALL be encrypted at rest within D1 and R2 storage.
- NFR-SEC-04: Channel credentials (API keys, bot tokens) SHALL be stored exclusively as Cloudflare Workers Secrets and SHALL NOT be persisted, logged, or displayed in plaintext anywhere in the application layer, including the Admin Console UI.
- NFR-SEC-05: The read-only detail view (§3.9) SHALL rely exclusively on short-lived, single-use tokens; the system SHALL NOT implement persistent password-based or long-lived session authentication for End Users.
- NFR-SEC-06: Admin Console access SHALL be gated exclusively by Cloudflare Access SSO; the system SHALL NOT implement a fallback custom authentication mechanism.
- NFR-SEC-07: The system SHALL enforce strict multi-tenant data isolation: every D1 query touching user-scoped data SHALL be filtered by `user_id`, and this SHALL be verifiable via code review/testing as a standing architectural invariant.
- NFR-SEC-08 (Regulatory Compliance — UU PDP): The system SHALL comply with Indonesia's Personal Data Protection Law (UU No. 27/2022, "UU PDP") with respect to the personal and financial data it processes, including but not limited to:
  - Obtaining explicit user consent during onboarding prior to processing personal data (FR-ONB-02), with a clear description of what data is collected and why.
  - Limiting data collection and retention to what is necessary for the stated purpose (data minimization).
  - Providing a mechanism, accessible via chat or through the Admin Console on the user's behalf, for a user to request access to, correction of, or deletion of their personal data.
  - Ensuring that any transfer of personal data to third-party processors (Workers AI, Xendit, api.co.id, Telegram) is covered by an appropriate legal basis and, where applicable, a data processing agreement.
  - Maintaining a breach-notification-capable posture, including audit logging (FR-ADM-10) sufficient to reconstruct access to affected data in the event of an incident.
- NFR-SEC-09: All administrative actions SHALL be individually attributable to a specific authenticated staff identity via `admin_audit_log`, with no shared or anonymous admin access permitted.

### 4.3 Reliability & Availability

- NFR-REL-01: The system SHALL target an availability of **99.5%** measured on a monthly basis (approximately 3.6 hours of allowable downtime per month), consistent with an early-stage product operating on Cloudflare's edge infrastructure.
- NFR-REL-02: The system SHALL continuously monitor the health of each active messaging channel via the daily validation cycle (FR-ADM-04) and SHALL automatically reflect degraded channels as inactive (FR-ADM-05) rather than allowing silent failure.
- NFR-REL-03: D1 data SHALL be included in Cloudflare's standard backup/durability guarantees; the system SHOULD additionally define an application-level backup/export procedure for disaster-recovery purposes, given the financial sensitivity of the data.
- NFR-REL-04: In the event of a total outage of one messaging channel, the system SHALL continue to operate normally for users reachable via the other active channel, given the multi-channel architecture (§3.10).
- NFR-REL-05: The system SHALL define and document a recovery time objective (RTO) and recovery point objective (RPO) appropriate to a 99.5% availability target as part of operational runbooks (specific numeric targets to be defined during implementation planning).

### 4.4 Usability & Accessibility

- NFR-USE-01: The system SHALL require no dedicated application installation by End Users; all core functionality SHALL be accessible via the End User's existing WhatsApp or Telegram client.
- NFR-USE-02: All bot-facing language SHALL avoid accounting/technical jargon (e.g., "debit," "credit," "journal entry") in user-facing chat copy, presenting concepts in plain, everyday language appropriate to the target persona (§2.2 of the PRD).
- NFR-USE-03: The read-only detail view (§3.9) SHALL be responsive and SHALL render legibly on mobile viewport widths as the primary expected access context.
- NFR-USE-04: The system SHALL support both strict command syntax and natural-language phrasing for all chat-native actions (budgeting, categorization, editing) to accommodate users unfamiliar with command-based interfaces, particularly on WhatsApp where no native command menu exists.
- NFR-USE-05: Error and clarification messages (e.g., EC-TXT-01, EC-EDT-01) SHALL be phrased as natural conversational follow-ups, not raw system error text.
- NFR-USE-06: The Admin Console SHOULD follow standard web accessibility practices (e.g., WCAG 2.1 AA as a target guideline) given its use by internal staff, though this is a should-level (not must-level) requirement given its internal-only audience.

---

## 5. Interface Requirements

### 5.1 User Interfaces

- **Chat interface (primary, End User):** No custom UI is rendered by Struku itself; the interface consists entirely of native WhatsApp and Telegram message rendering (text, images, documents, and, where supported, interactive buttons/quick replies). The system SHALL degrade gracefully on the channel with more limited interactive capability rather than assuming feature parity between WhatsApp and Telegram.
- **Detail view (secondary, End User):** A minimal, responsive, read-only web page (§3.9), accessible only via a short-lived link delivered in chat. SHALL NOT require any account creation, password, or persistent login on the End User's part.
- **Admin Console (internal staff only):** A standard authenticated web application, accessed via desktop browser, covering channel configuration (§3.14), user/data/subscription management, and audit log review (§3.15). SHALL be visually and functionally distinct from the End User-facing surfaces, reflecting its different user class and access model.

### 5.2 External Interface / API Requirements

| External System | Interface Type | Purpose | Key Requirements |
|---|---|---|---|
| **api.co.id (WhatsApp Cloud API)** | REST API (outbound) + HMAC-signed webhook (inbound) | Send/receive WhatsApp messages, including text, images, and documents | System SHALL verify inbound webhook signatures (NFR-SEC-02); SHALL use bearer-token authentication for outbound calls, with the token stored per NFR-SEC-04 |
| **Telegram Bot API** | REST API (outbound) + webhook (inbound) | Send/receive Telegram messages, including text, images, documents, and reply-to-message context | System SHALL register and validate the webhook endpoint per channel activation rules (FR-ADM-02–FR-ADM-03) |
| **Cloudflare Workers AI** | Internal binding / API | Image-based receipt parsing (vision model) and natural-language text parsing | System SHALL handle model timeout/failure gracefully (EC-IMG-01, EC-TXT-01) without blocking the surrounding chat flow indefinitely |
| **Frankfurter API** | REST API | Daily exchange rate retrieval for multi-currency support | System SHALL cache results in D1 and SHALL NOT call this API synchronously per transaction (FR-CUR-03–FR-CUR-04) |
| **Xendit** | REST API + webhook | Payment processing for paid-tier subscriptions | System SHALL verify payment webhook authenticity and SHALL reconcile subscription state defensively against delayed/failed webhooks (EC-SUB-02) |
| **Cloudflare Access** | SSO / identity provider integration | Admin Console authentication | System SHALL gate all Admin Console routes behind Cloudflare Access policy enforcement; no route SHALL be reachable without a valid Access session (NFR-SEC-06) |
| **Cloudflare R2** | Object storage API | Storage of receipt/transfer-proof images and generated PDF reports | Access SHALL be scoped such that objects are retrievable only through authenticated application logic, never via a publicly guessable direct URL |
| **Cloudflare D1** | SQL database interface | Persistence of all relational data (users, ledger, budgets, categories, channel configs, audit log) | All queries SHALL enforce `user_id` scoping per NFR-SEC-07 |
| **Cloudflare Workers Secrets** | Secrets binding | Storage of channel API keys/bot tokens | Referenced by name/binding from `channel_configs`; values SHALL never be exposed through any API response or UI (NFR-SEC-04) |

---

## Appendix A: Traceability Note

This SRS is derived from Struku PRD, Draft v3. Where the PRD used exploratory or descriptive language, this SRS has translated intent into normative SHALL/SHOULD/MAY requirements per §2 of the processing instructions governing this document's creation. No feature described here was introduced without a corresponding basis in the PRD; implicit technical details (e.g., specific error-handling branches, concurrency handling, rounding rules) have been made explicit where necessary for implementation precision, consistent with standard SRS practice under IEEE 830 / ISO/IEC/IEEE 29148.