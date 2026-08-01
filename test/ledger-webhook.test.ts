import { env, runDurableObjectAlarm, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	constantParseResult,
	injectFakeTextParser,
} from "./helpers/inject-fake-text-parser";
import type { ParseResult } from "../src/worker/parsing/types";

// Ticket 13: the full record-a-transaction loop, driven at the webhook seam
// (spec Testing Decisions). A clean parse starts a pending draft (choice
// prompt); confirm commits a balanced double-entry journal entry; discard and
// an unanswered timeout leave the ledger untouched.

let fetchSpy: ReturnType<
	typeof vi.fn<(url: string, init: RequestInit) => Promise<Response>>
>;
let nextUpdateId = 1;
let nextMessageId = 1;

beforeEach(() => {
	env.TELEGRAM_BOT_TOKEN = "test-bot-token";
	fetchSpy = vi.fn(
		async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
	);
	globalThis.fetch = fetchSpy as unknown as typeof fetch;
});

async function seedOnboardedUser(externalId: string): Promise<string> {
	const userId = crypto.randomUUID();
	const now = Date.now();
	await env.DB.batch([
		env.DB.prepare(
			`INSERT INTO users (id, locale, timezone, onboarding_completed_at, created_at)
			 VALUES (?, 'id-ID', 'Asia/Jakarta', ?, ?)`,
		).bind(userId, now, now),
		env.DB.prepare(
			`INSERT INTO channel_identities (id, user_id, channel, external_id, created_at)
			 VALUES (?, ?, 'telegram', ?, ?)`,
		).bind(crypto.randomUUID(), userId, externalId, now),
	]);

	// Provision the default chart of accounts (ticket 11's provisionUser does
	// this at onboarding completion; this test seeds users directly, so it
	// mints the same rows the ledger writer needs to resolve slugs against).
	const { DEFAULT_CHART_OF_ACCOUNTS } = await import(
		"../src/worker/ledger/chart-of-accounts"
	);
	await env.DB.batch(
		DEFAULT_CHART_OF_ACCOUNTS.map((entry) =>
			env.DB.prepare(
				`INSERT INTO accounts (id, user_id, slug, type, name, currency, is_default, created_at)
				 VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
			).bind(
				crypto.randomUUID(),
				userId,
				entry.slug,
				entry.type,
				entry.defaultName,
				entry.currency === "primary" ? "IDR" : null,
				now,
			),
		),
	);

	return userId;
}

async function injectCannedResult(
	userId: string,
	result: ParseResult,
): Promise<void> {
	await injectFakeTextParser(env.Coordinator, userId, constantParseResult(result));
}

interface OutboundCall {
	text: string;
	options?: { id: string; label: string }[];
}

async function send(chatId: number, text: string): Promise<OutboundCall> {
	const update = {
		update_id: nextUpdateId++,
		message: {
			message_id: nextMessageId++,
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

	const lastCall = fetchSpy.mock.calls.at(-1);
	if (!lastCall) throw new Error("no outbound Bot API call captured");
	const body = JSON.parse(lastCall[1].body as string) as {
		text: string;
		reply_markup?: { inline_keyboard: { text: string; callback_data: string }[][] };
	};
	return {
		text: body.text,
		options: body.reply_markup?.inline_keyboard[0]?.map((o) => ({
			id: o.callback_data,
			label: o.text,
		})),
	};
}

const CLEAN_EXPENSE: ParseResult = {
	intent: "transaction",
	txn_type: "expense",
	amount: 25000,
	currency: "IDR",
	category: "food",
	date: "2026-01-15",
	clarification: null,
};

describe("pending draft, confirm/edit/discard, double-entry commit (ticket 13)", () => {
	it("confirm commits exactly one balanced journal entry: expense_food debited / cash credited", async () => {
		const chatId = 850000001;
		const userId = await seedOnboardedUser(String(chatId));
		await injectCannedResult(userId, CLEAN_EXPENSE);

		const draftPrompt = await send(chatId, "kopi 25rb");
		expect(draftPrompt.options?.map((o) => o.id)).toEqual(
			expect.arrayContaining(["confirm", "edit", "discard"]),
		);

		const ack = await send(chatId, "confirm");
		expect(ack.text.toLowerCase()).not.toContain("belum");

		const { results: entries } = await env.DB.prepare(
			`SELECT id, entry_date, currency, source FROM journal_entries WHERE user_id = ?`,
		)
			.bind(userId)
			.all<{ id: string; entry_date: string; currency: string; source: string }>();
		expect(entries).toHaveLength(1);
		expect(entries[0].entry_date).toBe("2026-01-15");
		expect(entries[0].currency).toBe("IDR");
		expect(entries[0].source).toBe("text");

		const { results: lines } = await env.DB.prepare(
			`SELECT jl.direction, jl.amount_minor, a.slug
			 FROM journal_lines jl
			 JOIN accounts a ON a.id = jl.account_id
			 WHERE jl.entry_id = ?
			 ORDER BY jl.direction`,
		)
			.bind(entries[0].id)
			.all<{ direction: string; amount_minor: number; slug: string }>();

		expect(lines).toHaveLength(2);
		const debit = lines.find((l) => l.direction === "debit");
		const credit = lines.find((l) => l.direction === "credit");
		expect(debit?.slug).toBe("expense_food");
		expect(debit?.amount_minor).toBe(25000);
		expect(credit?.slug).toBe("cash");
		expect(credit?.amount_minor).toBe(25000);
	});

	it("a typed synonym ('ya') confirms identically to the button id (EC-CH-03)", async () => {
		const chatId = 850000002;
		const userId = await seedOnboardedUser(String(chatId));
		await injectCannedResult(userId, CLEAN_EXPENSE);

		await send(chatId, "kopi 25rb");
		await send(chatId, "ya");

		const { results } = await env.DB.prepare(
			`SELECT * FROM journal_entries WHERE user_id = ?`,
		)
			.bind(userId)
			.all();
		expect(results).toHaveLength(1);
	});

	it("discard clears the draft with no journal entry created", async () => {
		const chatId = 850000003;
		const userId = await seedOnboardedUser(String(chatId));
		await injectCannedResult(userId, CLEAN_EXPENSE);

		await send(chatId, "kopi 25rb");
		const ack = await send(chatId, "discard");

		expect(ack.text.toLowerCase()).toMatch(/batal|discard/);

		const { results } = await env.DB.prepare(
			`SELECT * FROM journal_entries WHERE user_id = ?`,
		)
			.bind(userId)
			.all();
		expect(results).toHaveLength(0);
	});

	it("an unanswered draft expires via its scheduled alarm with no commit (EC-IMG-05 pattern)", async () => {
		const chatId = 850000004;
		const userId = await seedOnboardedUser(String(chatId));
		await injectCannedResult(userId, CLEAN_EXPENSE);

		await send(chatId, "kopi 25rb");

		const id = env.Coordinator.idFromName(userId);
		const stub = env.Coordinator.get(id);
		const alarmRan = await runDurableObjectAlarm(stub);
		expect(alarmRan).toBe(true);

		// Re-sending the same transaction after expiry starts a fresh draft
		// rather than resurrecting the expired one.
		const secondPrompt = await send(chatId, "kopi 25rb");
		expect(secondPrompt.options).toBeDefined();

		const { results } = await env.DB.prepare(
			`SELECT * FROM journal_entries WHERE user_id = ?`,
		)
			.bind(userId)
			.all();
		expect(results).toHaveLength(0);
	});

	it("edit corrects the amount on the pending draft, then re-summarizes before commit", async () => {
		const chatId = 850000005;
		const userId = await seedOnboardedUser(String(chatId));
		await injectCannedResult(userId, CLEAN_EXPENSE);

		await send(chatId, "kopi 25rb");
		const whichField = await send(chatId, "edit");
		expect(whichField.text.toLowerCase()).toMatch(/jumlah|kategori|tanggal|jenis/);

		const newSummary = await send(chatId, "jumlah");
		expect(newSummary.text.toLowerCase()).toMatch(/berapa/);

		const resummarized = await send(chatId, "50000");
		expect(resummarized.text).toContain("Rp 50.000");
		expect(resummarized.options).toBeDefined();

		await send(chatId, "confirm");

		const { results: lines } = await env.DB.prepare(
			`SELECT amount_minor FROM journal_lines jl
			 JOIN journal_entries je ON je.id = jl.entry_id
			 WHERE je.user_id = ? AND jl.direction = 'debit'`,
		)
			.bind(userId)
			.all<{ amount_minor: number }>();
		expect(lines[0]?.amount_minor).toBe(50000);
	});

	it("a new transaction message while a draft is pending starts a new draft (EC-TXT-03)", async () => {
		const chatId = 850000006;
		const userId = await seedOnboardedUser(String(chatId));
		await injectCannedResult(userId, CLEAN_EXPENSE);

		await send(chatId, "kopi 25rb"); // first draft pending
		await injectCannedResult(userId, {
			...CLEAN_EXPENSE,
			amount: 100000,
			category: "transport",
		});
		const secondPrompt = await send(chatId, "bensin 100rb"); // second, NEW draft

		expect(secondPrompt.text).toContain("Rp 100.000");
		expect(secondPrompt.options).toBeDefined();

		// Both drafts should still be pending — confirming resolves to the
		// most-recently-created one (LIFO).
		await send(chatId, "confirm");

		const { results } = await env.DB.prepare(
			`SELECT jl.amount_minor FROM journal_lines jl
			 JOIN journal_entries je ON je.id = jl.entry_id
			 WHERE je.user_id = ? AND jl.direction = 'debit'`,
		)
			.bind(userId)
			.all<{ amount_minor: number }>();
		expect(results).toHaveLength(1);
		expect(results[0].amount_minor).toBe(100000);
	});

	// Ticket 22: description is a display label that defaults to the user's raw
	// text — the text is captured at startDraft and must survive on PendingDraft
	// all the way to commit (before 22 it was used for asset detection and
	// dropped). Not an archive: once edit lands (ticket 23) it is overwritten.
	it("commits the user's raw text verbatim into journal_entries.description", async () => {
		const chatId = 850000008;
		const userId = await seedOnboardedUser(String(chatId));
		await injectCannedResult(userId, CLEAN_EXPENSE);

		await send(chatId, "warteg 25rb");
		await send(chatId, "confirm");

		const { results } = await env.DB.prepare(
			`SELECT description FROM journal_entries WHERE user_id = ?`,
		)
			.bind(userId)
			.all<{ description: string | null }>();
		expect(results).toHaveLength(1);
		expect(results[0].description).toBe("warteg 25rb");
	});

	it("stores the text verbatim, without trimming or normalizing it", async () => {
		const chatId = 850000011;
		const userId = await seedOnboardedUser(String(chatId));
		await injectCannedResult(userId, CLEAN_EXPENSE);

		// Leading/trailing space and a typo: the ledger keeps user text as-is.
		await send(chatId, "  wartegg  25rb  ");
		await send(chatId, "confirm");

		const { results } = await env.DB.prepare(
			`SELECT description FROM journal_entries WHERE user_id = ?`,
		)
			.bind(userId)
			.all<{ description: string | null }>();
		expect(results[0].description).toBe("  wartegg  25rb  ");
	});

	it("keeps the original text after an edit changes another field", async () => {
		const chatId = 850000009;
		const userId = await seedOnboardedUser(String(chatId));
		await injectCannedResult(userId, CLEAN_EXPENSE);

		await send(chatId, "warteg 25rb");
		await send(chatId, "edit");
		await send(chatId, "jumlah");
		await send(chatId, "50000"); // the edit reply must not become the description
		await send(chatId, "confirm");

		const { results } = await env.DB.prepare(
			`SELECT description FROM journal_entries WHERE user_id = ?`,
		)
			.bind(userId)
			.all<{ description: string | null }>();
		expect(results[0].description).toBe("warteg 25rb");
	});

	it("carries each draft's own text when two drafts are pending (EC-TXT-03, LIFO)", async () => {
		const chatId = 850000010;
		const userId = await seedOnboardedUser(String(chatId));
		await injectCannedResult(userId, CLEAN_EXPENSE);

		await send(chatId, "warteg 25rb");
		await injectCannedResult(userId, {
			...CLEAN_EXPENSE,
			amount: 100000,
			category: "transport",
		});
		await send(chatId, "bensin 100rb");
		await send(chatId, "confirm"); // resolves to the most recent draft

		const { results } = await env.DB.prepare(
			`SELECT description FROM journal_entries WHERE user_id = ?`,
		)
			.bind(userId)
			.all<{ description: string | null }>();
		expect(results).toHaveLength(1);
		expect(results[0].description).toBe("bensin 100rb");
	});

	// Ticket 23 part B: the commit reply echoes the transaction (a closing
	// marker, not new information) and adds today's expense total — the one
	// genuinely new thing. Shape decided in grilling: entry_date (not
	// created_at), expenses only (not net), single-currency (option A plain).
	it("commit reply echoes the transaction and adds today's expense total", async () => {
		const chatId = 850000012;
		const userId = await seedOnboardedUser(String(chatId));
		await injectCannedResult(userId, CLEAN_EXPENSE);

		await send(chatId, "warteg 25rb");
		const ack = await send(chatId, "confirm");

		expect(ack.text).toContain("Rp 25.000");
		expect(ack.text).toContain("Makan");
		expect(ack.text).toContain("Rp 25.000"); // daily total: the only entry so far
		expect(ack.text.toLowerCase()).toContain("hari ini");
	});

	it("sums same-day expenses into the daily total", async () => {
		const chatId = 850000013;
		const userId = await seedOnboardedUser(String(chatId));

		await injectCannedResult(userId, CLEAN_EXPENSE);
		await send(chatId, "warteg 25rb");
		await send(chatId, "confirm");

		await injectCannedResult(userId, { ...CLEAN_EXPENSE, amount: 100000, category: "transport" });
		await send(chatId, "bensin 100rb");
		const ack = await send(chatId, "confirm");

		expect(ack.text).toContain("Rp 125.000");
	});

	// Trap (b) from research 14: a naive direction='debit' filter also catches
	// the cash leg of an income entry. Income must not appear in the total.
	it("excludes income from the daily expense total (not net)", async () => {
		const chatId = 850000014;
		const userId = await seedOnboardedUser(String(chatId));

		await injectCannedResult(userId, CLEAN_EXPENSE);
		await send(chatId, "warteg 25rb");
		await send(chatId, "confirm");

		await injectCannedResult(userId, {
			...CLEAN_EXPENSE,
			txn_type: "income",
			amount: 5000000,
			category: "salary",
		});
		await send(chatId, "gaji 5jt");
		const ack = await send(chatId, "confirm");

		// Committing income still reports the day's EXPENSES — 25.000, untouched
		// by the 5.000.000 income. The echo line does show the income that was
		// just committed, so the total line is asserted on specifically.
		const totalLine = ack.text
			.split("\n")
			.find((l) => l.toLowerCase().includes("hari ini"));
		expect(totalLine).toContain("Rp 25.000");
		expect(totalLine).not.toContain("5.000.000");
		expect(totalLine).not.toContain("4.975.000"); // not net either
	});

	// "Today" means entry_date, not created_at: a backdated entry recorded now
	// belongs to its own accounting date, so it must not inflate today's total.
	it("counts by entry_date, so a backdated entry stays out of today's total", async () => {
		const chatId = 850000015;
		const userId = await seedOnboardedUser(String(chatId));

		await injectCannedResult(userId, { ...CLEAN_EXPENSE, date: "2026-01-10", amount: 99000 });
		await send(chatId, "belanja kemarin 99rb");
		await send(chatId, "confirm");

		await injectCannedResult(userId, CLEAN_EXPENSE); // date 2026-01-15
		await send(chatId, "warteg 25rb");
		const ack = await send(chatId, "confirm");

		expect(ack.text).toContain("Rp 25.000");
		expect(ack.text).not.toContain("Rp 124.000"); // the 2026-01-10 entry is not today's
	});

	// Option A (plain): only the committed transaction's own currency is
	// totalled. A same-day USD expense is silently out of scope — accepted
	// deliberately; seeing it is ticket 16's job.
	it("totals only the committed transaction's currency", async () => {
		const chatId = 850000016;
		const userId = await seedOnboardedUser(String(chatId));

		// $15 = 1500 minor units. If the currency filter were missing, those
		// 1500 would be added to the IDR total (25.000 -> 26.500), so asserting
		// the exact IDR figure is what proves the separation.
		await injectCannedResult(userId, {
			...CLEAN_EXPENSE,
			currency: "USD",
			amount: 15,
			category: "entertainment",
		});
		await send(chatId, "netflix 15 usd");
		await send(chatId, "confirm");

		await injectCannedResult(userId, CLEAN_EXPENSE);
		await send(chatId, "warteg 25rb");
		const ack = await send(chatId, "confirm");

		const totalLine = ack.text
			.split("\n")
			.find((l) => l.toLowerCase().includes("hari ini"));
		expect(totalLine).toContain("Rp 25.000");
		expect(totalLine).not.toContain("Rp 26.500"); // the USD legs did not leak in
	});

	// The USD side of the same split, to pin the exponent handling: a USD total
	// must render in major units ($ 15), not raw minor units ($ 1.500).
	it("renders a foreign-currency daily total in major units", async () => {
		const chatId = 850000017;
		const userId = await seedOnboardedUser(String(chatId));

		await injectCannedResult(userId, {
			...CLEAN_EXPENSE,
			currency: "USD",
			amount: 15,
			category: "entertainment",
		});
		await send(chatId, "netflix 15 usd");
		const ack = await send(chatId, "confirm");

		const totalLine = ack.text
			.split("\n")
			.find((l) => l.toLowerCase().includes("hari ini"));
		expect(totalLine).toContain("$ 15");
		expect(totalLine).not.toContain("1.500");
	});

	it("keeps a foreign-currency transaction in its own currency through commit", async () => {
		const chatId = 850000007;
		const userId = await seedOnboardedUser(String(chatId));
		await injectCannedResult(userId, {
			intent: "transaction",
			txn_type: "expense",
			amount: 15,
			currency: "USD",
			category: "entertainment",
			date: "2026-01-15",
			clarification: null,
		});

		await send(chatId, "netflix 15 usd");
		await send(chatId, "confirm");

		const { results: entries } = await env.DB.prepare(
			`SELECT id, currency FROM journal_entries WHERE user_id = ?`,
		)
			.bind(userId)
			.all<{ id: string; currency: string }>();
		expect(entries[0].currency).toBe("USD");

		const { results: lines } = await env.DB.prepare(
			`SELECT amount_minor, currency FROM journal_lines WHERE entry_id = ?`,
		)
			.bind(entries[0].id)
			.all<{ amount_minor: number; currency: string }>();
		// USD exponent 2: $15 -> 1500 minor units.
		expect(lines.every((l) => l.amount_minor === 1500)).toBe(true);
		expect(lines.every((l) => l.currency === "USD")).toBe(true);
	});
});
