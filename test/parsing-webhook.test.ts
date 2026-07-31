import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	constantParseResult,
	injectFakeTextParser,
} from "./helpers/inject-fake-text-parser";
import type { ParseResult } from "../src/worker/parsing/types";

// Ticket 12: an onboarded user's free-text message is parsed and understood.
// As of ticket 13, a clean transaction parse (amount + txn_type present)
// starts a pending draft and surfaces as a confirm/edit/discard choice
// prompt rather than plain text — the summary content itself (resolved
// amount, category, direction, date) is still exactly what ticket 12 built;
// see test/ledger-webhook.test.ts for the confirm/discard/edit/timeout flow
// this feeds into. Clarification / stub / unknown replies are unaffected by
// ticket 13 and remain plain text.
//
// Deterministic gating tests inject a fake TextParser above env.AI (spec
// Testing Decisions) with the canned ParseResults the ticket calls out: clean
// expense, income, foreign-currency expense, missing-amount clarification,
// non-transaction intent.

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
	env.TELEGRAM_BOT_TOKEN = "test-bot-token";
	fetchSpy = vi.fn(
		async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
	);
	globalThis.fetch = fetchSpy as unknown as typeof fetch;
});

async function seedOnboardedUser(
	externalId: string,
	overrides: Partial<{ locale: string; timezone: string }> = {},
): Promise<string> {
	const userId = crypto.randomUUID();
	const now = Date.now();
	await env.DB.batch([
		env.DB.prepare(
			`INSERT INTO users (id, locale, timezone, onboarding_completed_at, created_at)
			 VALUES (?, ?, ?, ?, ?)`,
		).bind(
			userId,
			overrides.locale ?? "id-ID",
			overrides.timezone ?? "Asia/Jakarta",
			now,
			now,
		),
		env.DB.prepare(
			`INSERT INTO channel_identities (id, user_id, channel, external_id, created_at)
			 VALUES (?, ?, 'telegram', ?, ?)`,
		).bind(crypto.randomUUID(), userId, externalId, now),
	]);
	return userId;
}

async function injectCannedResult(
	userId: string,
	result: ParseResult,
): Promise<void> {
	await injectFakeTextParser(env.Coordinator, userId, constantParseResult(result));
}

async function sendText(
	chatId: number,
	text: string,
): Promise<{ text: string; isChoicePrompt: boolean }> {
	const update = {
		update_id: Math.floor(Math.random() * 1_000_000_000),
		message: {
			message_id: Math.floor(Math.random() * 1_000_000_000),
			from: {
				id: chatId,
				is_bot: false,
				first_name: "Test User",
				username: "testuser",
				language_code: "en",
			},
			chat: { id: chatId, first_name: "Test User", type: "private" },
			date: Math.floor(Date.now() / 1000),
			text,
		},
	};
	await SELF.fetch("https://example.com/api/telegram/webhook", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(update),
	});

	const lastCall = fetchSpy.mock.calls.at(-1) as
		| [string, RequestInit]
		| undefined;
	if (!lastCall) throw new Error("no outbound Bot API call captured");
	const body = JSON.parse(lastCall[1].body as string) as {
		text: string;
		reply_markup?: unknown;
	};
	return { text: body.text, isChoicePrompt: body.reply_markup !== undefined };
}

describe("free-text parse & intent routing (ticket 12)", () => {
	it("a clean expense parse yields a plain-language summary with resolved amount, category, direction, date", async () => {
		const chatId = 800000001;
		const userId = await seedOnboardedUser(String(chatId));
		await injectCannedResult(userId, {
			intent: "transaction",
			txn_type: "expense",
			amount: 25000,
			currency: "IDR",
			category: "food",
			date: null,
			clarification: null,
		});

		const reply = await sendText(chatId, "kopi 25rb");

		expect(reply.text).toContain("Rp 25.000");
		expect(reply.text.toLowerCase()).toContain("makan");
		expect(reply.text.toLowerCase()).toContain("pengeluaran");
		// No accounting jargon (NFR-USE-02).
		expect(reply.text.toLowerCase()).not.toContain("debit");
		expect(reply.text.toLowerCase()).not.toContain("credit");
		expect(reply.text.toLowerCase()).not.toContain("journal");
		// Ticket 13: a clean parse starts a pending draft, not a bare reply.
		expect(reply.isChoicePrompt).toBe(true);
	});

	it("a clean income parse is labelled as income, not expense", async () => {
		const chatId = 800000002;
		const userId = await seedOnboardedUser(String(chatId));
		await injectCannedResult(userId, {
			intent: "transaction",
			txn_type: "income",
			amount: 5000000,
			currency: "IDR",
			category: "salary",
			date: null,
			clarification: null,
		});

		const reply = await sendText(chatId, "gaji masuk 5jt");

		expect(reply.text).toContain("Rp 5.000.000");
		expect(reply.text.toLowerCase()).toContain("pemasukan");
		expect(reply.text.toLowerCase()).toContain("gaji");
		expect(reply.isChoicePrompt).toBe(true);
	});

	it("a foreign-currency expense keeps its own currency, not converted to IDR", async () => {
		const chatId = 800000003;
		const userId = await seedOnboardedUser(String(chatId), { locale: "en-US" });
		await injectCannedResult(userId, {
			intent: "transaction",
			txn_type: "expense",
			amount: 15,
			currency: "USD",
			category: "entertainment",
			date: null,
			clarification: null,
		});

		const reply = await sendText(chatId, "bayar netflix 15 usd");

		expect(reply.text).toContain("$ 15");
		expect(reply.text).not.toContain("Rp");
		expect(reply.isChoicePrompt).toBe(true);
	});

	it("defaults the date to today in the user's timezone when the model returns null", async () => {
		const chatId = 800000004;
		const userId = await seedOnboardedUser(String(chatId), {
			timezone: "Asia/Jakarta",
		});
		await injectCannedResult(userId, {
			intent: "transaction",
			txn_type: "expense",
			amount: 10000,
			currency: "IDR",
			category: "food",
			date: null,
			clarification: null,
		});

		const reply = await sendText(chatId, "makan 10rb");

		const today = new Intl.DateTimeFormat("en-CA", {
			timeZone: "Asia/Jakarta",
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		}).format(new Date());
		expect(reply.text).toContain(today);
		expect(reply.isChoicePrompt).toBe(true);
	});

	it("a missing-amount parse yields the clarification question, never a fabricated amount (EC-TXT-01/02)", async () => {
		const chatId = 800000005;
		const userId = await seedOnboardedUser(String(chatId));
		await injectCannedResult(userId, {
			intent: "transaction",
			txn_type: "expense",
			amount: null,
			currency: "IDR",
			category: "food",
			date: null,
			clarification: "Berapa biaya jajan bakso tadi siang?",
		});

		const reply = await sendText(chatId, "jajan bakso tadi siang");

		expect(reply.text).toBe("Berapa biaya jajan bakso tadi siang?");
		expect(reply.text).not.toMatch(/\d/); // no invented number
	});

	it("a budget intent gets a graceful not-built-yet stub, not recorded as a spend", async () => {
		const chatId = 800000006;
		const userId = await seedOnboardedUser(String(chatId));
		await injectCannedResult(userId, {
			intent: "budget",
			txn_type: null,
			amount: null,
			currency: "IDR",
			category: null,
			date: null,
			clarification: null,
		});

		const reply = await sendText(chatId, "set budget makan 500rb");

		expect(reply.text.toLowerCase()).toContain("belum");
	});

	it("a query intent gets a graceful not-built-yet stub", async () => {
		const chatId = 800000007;
		const userId = await seedOnboardedUser(String(chatId));
		await injectCannedResult(userId, {
			intent: "query",
			txn_type: null,
			amount: null,
			currency: "IDR",
			category: null,
			date: null,
			clarification: null,
		});

		const reply = await sendText(chatId, "berapa pengeluaran bulan ini?");

		expect(reply.text.toLowerCase()).toContain("belum");
	});

	it("an unknown intent asks the user to rephrase", async () => {
		const chatId = 800000008;
		const userId = await seedOnboardedUser(String(chatId));
		await injectCannedResult(userId, {
			intent: "unknown",
			txn_type: null,
			amount: null,
			currency: "IDR",
			category: null,
			date: null,
			clarification: null,
		});

		const reply = await sendText(chatId, "asdkjfh");

		expect(reply.text.toLowerCase()).toMatch(/ngerti|rephrase/);
	});

	it("does not write anything to the ledger for a clean parse alone, before confirm (ticket 13 commits only on confirm)", async () => {
		const chatId = 800000009;
		const userId = await seedOnboardedUser(String(chatId));
		await injectCannedResult(userId, {
			intent: "transaction",
			txn_type: "expense",
			amount: 25000,
			currency: "IDR",
			category: "food",
			date: null,
			clarification: null,
		});

		await sendText(chatId, "kopi 25rb");

		const { results } = await env.DB.prepare(
			`SELECT * FROM journal_entries WHERE user_id = ?`,
		)
			.bind(userId)
			.all();
		expect(results).toHaveLength(0);
	});
});
