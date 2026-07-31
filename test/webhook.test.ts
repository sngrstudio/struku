import { env, SELF } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import callbackQueryFixture from "../.scratch/struku-v1/fixtures/telegram-callback-query.json";
import telegramFixtures from "../.scratch/struku-v1/fixtures/telegram-updates.json";

// Ticket 10 behavioral tests, driven at the primary seam (spec Testing
// Decisions): POST a raw Telegram Update to the webhook route and assert on
// the two observable outputs — what the bot sent back, and (from ticket 11+)
// what landed in D1. Ticket 10 only wires the echo stand-in, so here the
// observable output is just the outbound Bot API call.
//
// Real: the Hono router + D1, both via vitest-pool-workers. Faked: outbound
// Telegram HTTP, via a global fetch override (the interceptor the spec calls
// for) — TelegramProvider defaults to globalThis.fetch, so overriding it here
// captures every outbound Bot API call without touching production code.

const [plainTextUpdate] = telegramFixtures.result;

let fetchSpy: ReturnType<typeof vi.fn>;
let originalFetch: typeof fetch;

beforeEach(() => {
	originalFetch = globalThis.fetch;
	fetchSpy = vi.fn(
		async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
	);
	globalThis.fetch = fetchSpy as unknown as typeof fetch;
});

afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("POST /api/telegram/webhook — activation gate", () => {
	it("returns 200 and sends no reply when TELEGRAM_BOT_TOKEN is unset (inactive channel, EC-CH-01)", async () => {
		const originalToken = env.TELEGRAM_BOT_TOKEN;
		env.TELEGRAM_BOT_TOKEN = "";

		try {
			const response = await SELF.fetch(
				"https://example.com/api/telegram/webhook",
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(plainTextUpdate),
				},
			);

			expect(response.status).toBe(200);
			expect(fetchSpy).not.toHaveBeenCalled();
		} finally {
			env.TELEGRAM_BOT_TOKEN = originalToken;
		}
	});
});

describe("POST /api/telegram/webhook — round trip", () => {
	beforeEach(() => {
		env.TELEGRAM_BOT_TOKEN = "test-bot-token";
	});

	it("normalizes a plain-text Update and echoes it back via sendMessage", async () => {
		const response = await SELF.fetch(
			"https://example.com/api/telegram/webhook",
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(plainTextUpdate),
			},
		);

		expect(response.status).toBe(200);
		expect(fetchSpy).toHaveBeenCalledTimes(1);

		const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
		expect(url).toBe(
			"https://api.telegram.org/bottest-bot-token/sendMessage",
		);
		const body = JSON.parse(init.body as string);
		expect(body.chat_id).toBe("111111111");
		expect(body.text).toContain("matcha 50k");
	});

	it("mints a user + channel_identities row on first contact from an unknown chat", async () => {
		await SELF.fetch("https://example.com/api/telegram/webhook", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(plainTextUpdate),
		});

		const { results } = await env.DB.prepare(
			`SELECT u.id as user_id, ci.channel, ci.external_id
			 FROM channel_identities ci
			 JOIN users u ON u.id = ci.user_id
			 WHERE ci.channel = 'telegram' AND ci.external_id = ?`,
		)
			.bind("111111111")
			.all<{ user_id: string; channel: string; external_id: string }>();

		expect(results).toHaveLength(1);
		expect(results[0].external_id).toBe("111111111");
	});

	it("resolves the same user_id on a second message from the same chat (no duplicate identity)", async () => {
		const [, replyUpdate] = telegramFixtures.result;

		await SELF.fetch("https://example.com/api/telegram/webhook", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(plainTextUpdate),
		});
		await SELF.fetch("https://example.com/api/telegram/webhook", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(replyUpdate),
		});

		const { results } = await env.DB.prepare(
			`SELECT user_id FROM channel_identities WHERE channel = 'telegram' AND external_id = ?`,
		)
			.bind("111111111")
			.all<{ user_id: string }>();

		expect(results).toHaveLength(1);
	});

	it("swallows a malformed/unparseable Update, still returns 200, and sends no reply (EC-CH-02)", async () => {
		const response = await SELF.fetch(
			"https://example.com/api/telegram/webhook",
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ update_id: 1, weird_field: true }),
			},
		);

		expect(response.status).toBe(200);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("normalizes a callback_query tap and echoes option.id back (EC-CH-03)", async () => {
		const response = await SELF.fetch(
			"https://example.com/api/telegram/webhook",
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(callbackQueryFixture),
			},
		);

		expect(response.status).toBe(200);
		expect(fetchSpy).toHaveBeenCalledTimes(1);
		const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
		const body = JSON.parse(init.body as string);
		expect(body.text).toContain("confirm");
	});
});
