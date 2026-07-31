import { getAgentByName } from "agents";
import { Hono } from "hono";
import { resolveUserId } from "./identity";
import { TelegramProvider } from "./messaging/telegram-provider";

export const webhook = new Hono<{ Bindings: Env }>();

// Ticket 10: the single webhook ingress (ADR-0004, spec "Modules & seams").
// Order is fixed and reviewable at exactly these checkpoints:
//   1. activation gate (EC-CH-01) — before any provider parsing
//   2. provider normalization (TelegramProvider — stateless translator)
//   3. identity resolution (router-owned, ADR-0004 §4 / ADR-0003 §1)
//   4. route to the user's Coordinator actor
//   5. always 200, even on parse failure (EC-CH-02)
webhook.post("/telegram/webhook", async (c) => {
	const botToken = c.env.TELEGRAM_BOT_TOKEN;

	// Activation gate: tracer #1 has no channel_configs table yet (spec Out of
	// Scope) — a single Telegram channel is "active" iff the secret is
	// configured. Rejected before any provider parsing runs (EC-CH-01).
	if (!botToken) {
		return c.body(null, 200);
	}

	const provider = new TelegramProvider(botToken);

	let rawPayload: unknown;
	try {
		rawPayload = await c.req.json();
	} catch (error) {
		console.error("telegram webhook: invalid JSON body", error);
		return c.body(null, 200);
	}

	const normalized = provider.receiveInboundMessage(rawPayload);

	// EC-CH-02: log and swallow, never crash the shared interface.
	if ("reason" in normalized) {
		console.error("telegram webhook: unparseable update", normalized.reason);
		return c.body(null, 200);
	}

	const userId = await resolveUserId(
		c.env.DB,
		normalized.channel,
		normalized.externalId,
	);

	const agent = await getAgentByName(c.env.Coordinator, userId);
	const replyText = await agent.handleInboundMessage(normalized);

	await provider.sendText(normalized.externalId, replyText);

	return c.body(null, 200);
});
