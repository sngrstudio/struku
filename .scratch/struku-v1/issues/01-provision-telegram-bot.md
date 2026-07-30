# 01 — Provision Telegram bot + webhook + secret

Type: task
Status: open
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

_(record what was done + facts later tickets depend on: secret binding name, webhook
URL, sample-fixture location)_
