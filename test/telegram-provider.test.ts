import { describe, expect, it, vi } from "vitest";
import callbackQueryFixture from "../.scratch/struku-v1/fixtures/telegram-callback-query.json";
import telegramFixtures from "../.scratch/struku-v1/fixtures/telegram-updates.json";
import { TelegramProvider } from "../src/worker/messaging/telegram-provider";

// Ticket 10: TelegramProvider is a stateless payload translator (ADR-0004).
// Inbound normalization is checked against the real captured fixtures
// (ground truth); outbound rendering is checked against faked Bot API fetch
// calls, never a live Telegram request.

const BOT_TOKEN = "test-bot-token";

function provider(fetchImpl: typeof fetch) {
	return new TelegramProvider(BOT_TOKEN, fetchImpl);
}

describe("TelegramProvider.receiveInboundMessage", () => {
	it("normalizes a plain-text Update", () => {
		const [plainText] = telegramFixtures.result;
		const result = provider(vi.fn()).receiveInboundMessage(plainText);

		expect(result).toEqual({
			channel: "telegram",
			externalId: "111111111",
			senderDisplayName: "Test User",
			messageId: "4",
			replyToId: null,
			timestamp: 1785486739 * 1000,
			kind: "text",
			text: "matcha 50k",
		});
	});

	it("normalizes a reply-to-message Update, carrying replyToId", () => {
		const [, replyUpdate] = telegramFixtures.result;
		const result = provider(vi.fn()).receiveInboundMessage(replyUpdate);

		expect(result).toEqual({
			channel: "telegram",
			externalId: "111111111",
			senderDisplayName: "Test User",
			messageId: "5",
			replyToId: "4",
			timestamp: 1785486756 * 1000,
			kind: "text",
			text: "batal, hapus",
		});
	});

	it("normalizes a callback_query tap to kind:'text' with option.id as text (EC-CH-03)", () => {
		const result = provider(vi.fn()).receiveInboundMessage(
			callbackQueryFixture,
		);

		expect(result).toEqual({
			channel: "telegram",
			externalId: "111111111",
			senderDisplayName: "Test User",
			messageId: "6",
			replyToId: null,
			timestamp: 1785486800 * 1000,
			kind: "text",
			text: "confirm",
		});
	});

	it("returns an InboundParseFailure for a malformed/unrecognized Update (EC-CH-02)", () => {
		const result = provider(vi.fn()).receiveInboundMessage({
			update_id: 1,
			weird_field: true,
		});

		expect(result).toEqual({
			channel: "telegram",
			reason: expect.any(String),
		});
	});

	it("returns an InboundParseFailure for non-object payloads without throwing", () => {
		expect(
			provider(vi.fn()).receiveInboundMessage(null),
		).toEqual({ channel: "telegram", reason: expect.any(String) });
		expect(
			provider(vi.fn()).receiveInboundMessage("not json"),
		).toEqual({ channel: "telegram", reason: expect.any(String) });
	});
});

describe("TelegramProvider outbound rendering", () => {
	it("sendText calls the Bot API sendMessage endpoint with chat_id and text", async () => {
		const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(
			async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
		);

		await provider(fetchMock as unknown as typeof fetch).sendText(
			"111111111",
			"halo dari Struku",
		);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe(
			`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
		);
		const body = JSON.parse(init.body as string);
		expect(body).toEqual({
			chat_id: "111111111",
			text: "halo dari Struku",
		});
	});

	it("sendChoicePrompt renders an inline keyboard with callback_data = option.id", async () => {
		const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(
			async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
		);

		await provider(fetchMock as unknown as typeof fetch).sendChoicePrompt(
			"111111111",
			"Confirm this transaction?",
			[
				{ id: "confirm", label: "Confirm" },
				{ id: "edit", label: "Edit" },
				{ id: "discard", label: "Discard" },
			],
		);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe(
			`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
		);
		const body = JSON.parse(init.body as string);
		expect(body).toEqual({
			chat_id: "111111111",
			text: "Confirm this transaction?",
			reply_markup: {
				inline_keyboard: [
					[
						{ text: "Confirm", callback_data: "confirm" },
						{ text: "Edit", callback_data: "edit" },
						{ text: "Discard", callback_data: "discard" },
					],
				],
			},
		});
	});
});

describe("TelegramProvider default fetch binding", () => {
	// Regression: the constructor's default fetchImpl was a bare `fetch`.
	// Stored as a property and invoked as `this.fetchImpl(...)`, it reached
	// workerd with `this` bound to the provider, which threw "Illegal
	// invocation: function called with incorrect `this` reference" — every
	// outbound send 500'd on the deployed Worker while miniflare stayed
	// green. Constructing without an explicit fetchImpl must therefore yield
	// a callable that survives being detached from its object.
	it("defaults to a bound fetch, not the bare global", () => {
		const defaulted = new TelegramProvider(BOT_TOKEN) as unknown as {
			fetchImpl: typeof fetch;
		};

		expect(typeof defaulted.fetchImpl).toBe("function");
		// Miniflare does not enforce fetch's `this` requirement, so no
		// behavioural assertion can reproduce the production failure here —
		// calling the detached function passes either way. What *is*
		// checkable is provenance: a bound function is a distinct object
		// from the global it wraps, so identity with `globalThis.fetch`
		// means the bind was dropped and the deployed Worker will 500.
		expect(defaulted.fetchImpl).not.toBe(globalThis.fetch);
	});
});
