# Telegram inbound fixtures

Real `Update` JSON captured from a live bot via **getUpdates** long-polling (no webhook,
no deploy, no secret storage — see [ticket #01](../issues/01-provision-telegram-bot.md),
resolved via the getUpdates path). These are the ground-truth payloads that
[ADR-0004](../../../docs/adr/0004-messaging-provider-seam.md)'s `TelegramProvider`
normalization is validated against, and the input shape the #05 AI-parsing spike consumes.

## What lives here

- `telegram-updates.json` — raw `getUpdates` response array. Should contain at minimum:
  a plain **text** message (e.g. `"kopi 25k"`) and a **reply-to-message** (a message sent
  as a reply, so `message.reply_to_message` is populated — the shape the §4.5 edit flow
  leans on).

## How these were captured

> The bot token is a **secret**: never commit it, never paste it into chat. It goes in a
> local shell variable for the capture, and (at build time, not now) into a Cloudflare
> Workers Secret named `TELEGRAM_BOT_TOKEN`.

```sh
# 1. Put the BotFather token in a shell var (leading space keeps it out of shell history)
 export TG_TOKEN='123456:ABC-DEF...'

# 2. Send the bot a few test messages from your own Telegram first (text + a reply),
#    THEN pull the updates:
curl -s "https://api.telegram.org/bot${TG_TOKEN}/getUpdates" \
  | python3 -m json.tool > telegram-updates.json     # or: | jq . > telegram-updates.json
```

Notes:
- `getUpdates` and `setWebhook` are **mutually exclusive** — a set webhook makes
  getUpdates return `409 Conflict`. We deliberately have **no** webhook yet; it's a
  build-time concern (`/implement`).
- The response contains your own test account's `chat.id` / `from.id` / `first_name`.
  It's your own bot, so committing it is fine; scrub to placeholders if you'd rather.
