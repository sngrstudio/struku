import { env, SELF } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CHART_OF_ACCOUNTS } from "../src/worker/ledger/chart-of-accounts";

// Ticket 11: onboarding driven at the webhook seam (spec Testing Decisions —
// "a transcript of a real conversation plus an assertion on the resulting
// books"). Real Telegram fixtures only cover a pre-onboarded chat's plain
// text; onboarding's own turns (button taps / typed answers) are synthesized
// per ADR-0004's callback_query -> {kind:'text', text: option.id} contract,
// since onboarding didn't exist yet when #01 captured fixtures.
//
// D1/DO storage in vitest-pool-workers is isolated per test *file*, not per
// `it()` — each test below uses its own synthetic chat id.

let fetchSpy: ReturnType<
	typeof vi.fn<(url: string, init: RequestInit) => Promise<Response>>
>;
let originalFetch: typeof fetch;
let nextUpdateId = 1;
let nextMessageId = 1;

beforeEach(() => {
	env.TELEGRAM_BOT_TOKEN = "test-bot-token";
	originalFetch = globalThis.fetch;
	fetchSpy = vi.fn(
		async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
	);
	globalThis.fetch = fetchSpy as unknown as typeof fetch;
});

afterEach(() => {
	globalThis.fetch = originalFetch;
});

async function send(
	chatId: number,
	text: string,
): Promise<{ text: string; options?: unknown[] }> {
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
		reply_markup?: {
			inline_keyboard: { text: string; callback_data: string }[][];
		};
	};
	return {
		text: body.text,
		options: body.reply_markup?.inline_keyboard[0],
	};
}

describe("onboarding, driven at the webhook seam", () => {
	it("walks a full transcript: language -> consent -> name -> currency -> timezone -> summary -> confirm, and provisions the account", async () => {
		const chatId = 700000001;

		const languagePrompt = await send(chatId, "hello");
		expect(languagePrompt.text).toContain("bahasa");

		const consentPrompt = await send(chatId, "id");
		expect(consentPrompt.text).toContain("Setuju");

		const nameAsk = await send(chatId, "consent_yes");
		expect(nameAsk.text).toContain("panggil");

		const currencyPrompt = await send(chatId, "Budi");
		expect(currencyPrompt.text).toContain("IDR");

		const timezonePrompt = await send(chatId, "accept_default");
		expect(timezonePrompt.text).toContain("WIB");

		const summary = await send(chatId, "accept_default");
		expect(summary.text).toContain("Budi");
		expect(summary.text).toContain("IDR");
		expect(summary.text).toContain("Asia/Jakarta");

		const ack = await send(chatId, "confirm");
		expect(ack.text.toLowerCase()).toContain("beres");

		const user = await env.DB.prepare(
			`SELECT u.id as user_id, u.display_name, u.primary_currency, u.timezone, u.onboarding_completed_at
			 FROM users u
			 JOIN channel_identities ci ON ci.user_id = u.id
			 WHERE ci.channel = 'telegram' AND ci.external_id = ?`,
		)
			.bind(String(chatId))
			.first<{
				user_id: string;
				display_name: string;
				primary_currency: string;
				timezone: string;
				onboarding_completed_at: number | null;
			}>();

		expect(user).toBeTruthy();
		expect(user?.display_name).toBe("Budi");
		expect(user?.primary_currency).toBe("IDR");
		expect(user?.timezone).toBe("Asia/Jakarta");
		expect(user?.onboarding_completed_at).toEqual(expect.any(Number));

		const { results: accounts } = await env.DB.prepare(
			`SELECT slug FROM accounts WHERE user_id = ? ORDER BY slug`,
		)
			.bind(user!.user_id)
			.all<{ slug: string }>();

		expect(accounts).toHaveLength(DEFAULT_CHART_OF_ACCOUNTS.length);
	});

	it("resumes from the stored step on the next message from the same chat, rather than restarting (EC-ONB-01)", async () => {
		const chatId = 700000002;

		await send(chatId, "first ever contact"); // language prompt
		await send(chatId, "id"); // -> consent

		// Simulate walking away: the NEXT message should resume at 'consent',
		// not restart at 'language'.
		const resumed = await send(chatId, "apaan sih ini"); // ambiguous, re-prompts consent
		expect(resumed.text).toContain("Setuju");

		const nameAsk = await send(chatId, "consent_yes");
		expect(nameAsk.text).toContain("panggil");
	});

	it("does not advance past consent on an ambiguous reply, driven through the webhook (NFR-SEC-08)", async () => {
		const chatId = 700000003;

		await send(chatId, "hello");
		await send(chatId, "id");

		const stillConsent = await send(chatId, "mungkin kali ya");
		expect(stillConsent.text).toContain("Setuju");

		const { results } = await env.DB.prepare(
			`SELECT u.onboarding_completed_at
			 FROM users u
			 JOIN channel_identities ci ON ci.user_id = u.id
			 WHERE ci.channel = 'telegram' AND ci.external_id = ?`,
		)
			.bind(String(chatId))
			.all<{ onboarding_completed_at: number | null }>();

		expect(results[0]?.onboarding_completed_at).toBeNull();
	});
});
