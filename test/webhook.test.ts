import { env, SELF } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import callbackQueryFixture from "../.scratch/struku-v1/fixtures/telegram-callback-query.json";
import telegramFixtures from "../.scratch/struku-v1/fixtures/telegram-updates.json";
import { injectFakeTextParser } from "./helpers/inject-fake-text-parser";
import type { ParseResult } from "../src/worker/parsing/types";

// These tests only care about the round-trip mechanics (webhook -> gate ->
// provider -> actor -> outbound reply), not what a real parse produces — the
// dedicated parsing behavioral tests live in test/parsing-webhook.test.ts.
// A canned clean-expense ParseResult stands in for ticket 10's old echo
// stand-in, with a marker in the clarification field the tests can assert on
// via a bogus amount that renders distinctively.
const CANNED_RESULT: ParseResult = {
	intent: "transaction",
	txn_type: "expense",
	amount: 123456,
	currency: "IDR",
	category: "food",
	date: "2026-01-01",
	clarification: null,
};

const parseCalls: string[] = [];

async function injectCannedTextParser(userId: string): Promise<void> {
	await injectFakeTextParser(env.Coordinator, userId, async (text) => {
		parseCalls.push(text);
		return CANNED_RESULT;
	});
}

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
//
// D1 storage in vitest-pool-workers is isolated per test *file*, not per
// `it()` — every test below gets its own synthetic chat id (cloned from the
// real fixtures, id swapped) so identity rows don't leak across tests.

const [plainTextFixture, replyFixture] = telegramFixtures.result;

interface FixtureUser {
	id: number;
}
interface FixtureMessage {
	chat: { id: number };
	from?: FixtureUser;
	reply_to_message?: FixtureMessage;
}
interface FixtureUpdate {
	message?: FixtureMessage;
	callback_query?: { from: FixtureUser; message: FixtureMessage };
}

function withChatId<T extends FixtureUpdate>(fixture: T, chatId: number): T {
	const clone = structuredClone(fixture);
	if (clone.message) {
		clone.message.chat.id = chatId;
		if (clone.message.from) clone.message.from.id = chatId;
		if (clone.message.reply_to_message) {
			clone.message.reply_to_message.chat.id = chatId;
			if (clone.message.reply_to_message.from) {
				clone.message.reply_to_message.from.id = chatId;
			}
		}
	}
	if (clone.callback_query) {
		clone.callback_query.from.id = chatId;
		clone.callback_query.message.chat.id = chatId;
	}
	return clone;
}

let fetchSpy: ReturnType<typeof vi.fn>;
let originalFetch: typeof fetch;

beforeEach(() => {
	originalFetch = globalThis.fetch;
	fetchSpy = vi.fn(
		async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
	);
	globalThis.fetch = fetchSpy as unknown as typeof fetch;
	parseCalls.length = 0;
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
					body: JSON.stringify(withChatId(plainTextFixture, 900000001)),
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

	// A returning, fully-onboarded user's messages skip onboarding entirely
	// (spec user story #12) and go through ticket 12's real (fake-injected in
	// tests) TextParser — see injectCannedTextParser above.
	async function seedOnboardedUser(externalId: string): Promise<string> {
		const userId = crypto.randomUUID();
		const now = Date.now();
		await env.DB.batch([
			env.DB.prepare(
				`INSERT INTO users (id, onboarding_completed_at, created_at) VALUES (?, ?, ?)`,
			).bind(userId, now, now),
			env.DB.prepare(
				`INSERT INTO channel_identities (id, user_id, channel, external_id, created_at)
				 VALUES (?, ?, 'telegram', ?, ?)`,
			).bind(crypto.randomUUID(), userId, externalId, now),
		]);
		return userId;
	}

	it("normalizes a plain-text Update and sends a reply for a returning (post-onboarding) user", async () => {
		const userId = await seedOnboardedUser("900000002");
		await injectCannedTextParser(userId);
		const update = withChatId(plainTextFixture, 900000002);

		const response = await SELF.fetch(
			"https://example.com/api/telegram/webhook",
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(update),
			},
		);

		expect(response.status).toBe(200);
		expect(fetchSpy).toHaveBeenCalledTimes(1);

		const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
		expect(url).toBe(
			"https://api.telegram.org/bottest-bot-token/sendMessage",
		);
		const body = JSON.parse(init.body as string);
		expect(body.chat_id).toBe("900000002");
		expect(body.text).toContain("123.456");
	});

	it("mints a user + channel_identities row on first contact from an unknown chat", async () => {
		const update = withChatId(plainTextFixture, 900000003);

		await SELF.fetch("https://example.com/api/telegram/webhook", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(update),
		});

		const { results } = await env.DB.prepare(
			`SELECT u.id as user_id, ci.channel, ci.external_id
			 FROM channel_identities ci
			 JOIN users u ON u.id = ci.user_id
			 WHERE ci.channel = 'telegram' AND ci.external_id = ?`,
		)
			.bind("900000003")
			.all<{ user_id: string; channel: string; external_id: string }>();

		expect(results).toHaveLength(1);
		expect(results[0].external_id).toBe("900000003");
	});

	it("resolves the same user_id on a second message from the same chat (no duplicate identity)", async () => {
		const firstUpdate = withChatId(plainTextFixture, 900000004);
		const secondUpdate = withChatId(replyFixture, 900000004);

		await SELF.fetch("https://example.com/api/telegram/webhook", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(firstUpdate),
		});
		await SELF.fetch("https://example.com/api/telegram/webhook", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(secondUpdate),
		});

		const { results } = await env.DB.prepare(
			`SELECT user_id FROM channel_identities WHERE channel = 'telegram' AND external_id = ?`,
		)
			.bind("900000004")
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

	it("normalizes a callback_query tap to text and delivers it to TextParser for a returning user (EC-CH-03)", async () => {
		const userId = await seedOnboardedUser("900000005");
		await injectCannedTextParser(userId);
		const update = withChatId(callbackQueryFixture, 900000005);

		const response = await SELF.fetch(
			"https://example.com/api/telegram/webhook",
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(update),
			},
		);

		expect(response.status).toBe(200);
		expect(fetchSpy).toHaveBeenCalledTimes(1);
		// EC-CH-03: the callback_query's data ("confirm") reached TextParser as
		// plain text — structurally identical to a typed reply, per ADR-0004 §2.
		expect(parseCalls).toContain("confirm");
	});
});
