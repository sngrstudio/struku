# 01 — Provision Telegram bot + webhook + secret

Type: task
Status: resolved
Blocked by: —

## Question

Stand up the live Telegram plumbing so tracer-bullet #1 can be tested end-to-end
against a real bot. Nothing to *decide* here — this is manual work that unblocks
later decisions (adapter seam, onboarding) being validated against real payloads.

Checklist (HITL — some steps only the human can do):

1. Create the bot via **@BotFather**, capture the bot token.
2. Store the token as a **Cloudflare Workers Secret** (never in D1 / never committed) —
   per NFR-SEC-04. Record the binding *name* only.
3. Register the webhook (`setWebhook`) against a dev Worker route (can be a stub that
   200s + logs the update) to observe real inbound `Update` JSON shape.
4. Capture 2–3 sample inbound updates (text message, a reply-to-message) as fixtures
   for the adapter seam ticket (#04) and parsing ticket (#05).

## Answer

Resolved via the **getUpdates polling** path (planning-appropriate: no webhook, no
secret storage, no deploy — those defer to `/implement`). See
[fixtures/README.md](../fixtures/README.md) for the capture method.

**Facts later tickets depend on:**

- **Bot:** `@StrukuBot` (id `8617997589`). No webhook set (`getWebhookInfo.url == ''`).
- **Fixtures:** [`.scratch/struku-v1/fixtures/telegram-updates.json`](../fixtures/telegram-updates.json)
  — 2 real `Update`s: a text message (`"matcha 50k"`) and a reply-to-message
  (`"batal, hapus"` with `reply_to_message` populated). Input the #05 AI-parsing spike
  consumes and the ground truth ADR-0004's `TelegramProvider` normalization is validated
  against.
- **Secret binding name (pinned convention):** `TELEGRAM_BOT_TOKEN` — to be stored via
  `wrangler secret put TELEGRAM_BOT_TOKEN` at build time, never in D1, never committed
  (NFR-SEC-04).

**Validation of ADR-0004 against real payloads:** shape confirmed. `chat.id` is the
identity (== `from.id` in private chats); `reply_to_message` nests a full `Message` so
`replyToId` maps to `reply_to_message.message_id`. One normalization detail: Telegram
`date` is unix **seconds**, so `TelegramProvider` must ×1000 for the envelope's millis
`timestamp` (noted in ADR-0004). `from.language_code` is present but unused (ADR-0003
collects language explicitly).

**Deferred to build (`/implement`), not decisions:** store the token as a Workers
Secret, register the production webhook (`setWebhook`), deploy the Worker.

**Security note:** the first token was accidentally exposed in the session transcript
(run via the in-session `!` prompt) and was **revoked** via BotFather; the replacement
token was handled out-of-band and deleted after capture.
