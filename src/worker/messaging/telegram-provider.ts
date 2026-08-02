import type {
	ChoiceOption,
	InboundParseFailure,
	MessagingProvider,
	NormalizedInboundMessage,
} from "./types";

// Minimal slice of the Telegram Bot API `Update`/`Message`/`User`/`Chat` shapes
// this provider reads (core.telegram.org/bots/api). Only the fields
// TelegramProvider actually touches — not a full API typing.
interface TelegramUser {
	id: number;
	first_name?: string;
}

interface TelegramMessage {
	message_id: number;
	date: number; // unix seconds
	text?: string;
	from?: TelegramUser;
	chat: { id: number };
	reply_to_message?: { message_id: number };
}

interface TelegramCallbackQuery {
	id: string;
	from: TelegramUser;
	message?: TelegramMessage;
	data?: string;
}

interface TelegramUpdate {
	update_id: number;
	message?: TelegramMessage;
	callback_query?: TelegramCallbackQuery;
}

function toTextMessage(
	message: TelegramMessage,
	senderDisplayName: string | undefined,
	replyToId: string | null,
	text: string,
): NormalizedInboundMessage {
	return {
		channel: "telegram",
		externalId: String(message.chat.id),
		senderDisplayName,
		messageId: String(message.message_id),
		replyToId,
		timestamp: message.date * 1000,
		kind: "text",
		text,
	};
}

function normalizeMessage(message: TelegramMessage): NormalizedInboundMessage {
	return toTextMessage(
		message,
		message.from?.first_name,
		message.reply_to_message
			? String(message.reply_to_message.message_id)
			: null,
		message.text ?? "",
	);
}

// EC-CH-03: a callback_query tap normalizes to the same kind:'text' shape as
// a typed reply, carrying option.id as the text (ADR-0004 §2).
function normalizeCallbackQuery(
	callbackQuery: TelegramCallbackQuery,
): NormalizedInboundMessage | InboundParseFailure {
	const { message } = callbackQuery;
	if (!message || callbackQuery.data === undefined) {
		return {
			channel: "telegram",
			reason: "callback_query missing message or data",
		};
	}

	return toTextMessage(
		message,
		callbackQuery.from.first_name,
		null,
		callbackQuery.data,
	);
}

export class TelegramProvider implements MessagingProvider {
	// The default must be `fetch.bind(globalThis)`, not a bare `fetch`. Stored
	// as a property and called as `this.fetchImpl(...)`, an unbound reference
	// arrives at the runtime with `this` set to this provider instead of the
	// global scope, and workerd rejects it with "Illegal invocation: function
	// called with incorrect `this` reference". Miniflare is lenient here, so
	// this only ever surfaced against the deployed Worker (500 on every
	// outbound send). Tests still inject their own fetchImpl unaffected.
	constructor(
		private readonly botToken: string,
		private readonly fetchImpl: typeof fetch = fetch.bind(globalThis),
	) {}

	private get apiBase(): string {
		return `https://api.telegram.org/bot${this.botToken}`;
	}

	private async callBotApi(
		method: string,
		body: Record<string, unknown>,
	): Promise<void> {
		await this.fetchImpl(`${this.apiBase}/${method}`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body),
		});
	}

	async sendText(to: string, text: string): Promise<void> {
		await this.callBotApi("sendMessage", { chat_id: to, text });
	}

	async sendMediaPrompt(to: string, text: string): Promise<void> {
		await this.callBotApi("sendMessage", { chat_id: to, text });
	}

	async sendChoicePrompt(
		to: string,
		text: string,
		options: ChoiceOption[],
	): Promise<void> {
		await this.callBotApi("sendMessage", {
			chat_id: to,
			text,
			reply_markup: {
				inline_keyboard: [
					options.map((option) => ({
						text: option.label,
						callback_data: option.id,
					})),
				],
			},
		});
	}

	async sendDocument(): Promise<void> {
		throw new Error("sendDocument is not implemented in tracer #1");
	}

	// Signature reserved per ADR-0004; the §3.11 linking flow is unbuilt fog.
	async sendLinkRequestCode(): Promise<void> {
		throw new Error("sendLinkRequestCode is not implemented in tracer #1");
	}

	receiveInboundMessage(
		rawPayload: unknown,
	): NormalizedInboundMessage | InboundParseFailure {
		try {
			if (typeof rawPayload !== "object" || rawPayload === null) {
				return { channel: "telegram", reason: "payload is not an object" };
			}

			const update = rawPayload as TelegramUpdate;

			if (update.message) {
				return normalizeMessage(update.message);
			}

			if (update.callback_query) {
				return normalizeCallbackQuery(update.callback_query);
			}

			return {
				channel: "telegram",
				reason: "Update contains neither message nor callback_query",
			};
		} catch (error) {
			return {
				channel: "telegram",
				reason: error instanceof Error ? error.message : String(error),
			};
		}
	}
}
