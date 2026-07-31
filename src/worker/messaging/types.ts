// MessagingProvider seam (ADR-0004): channel-agnostic interface so core bot
// logic never touches a provider-native payload shape. TelegramProvider is
// the first implementation; WhatsAppProvider stays fog.

export type Channel = "telegram" | "whatsapp";

export interface ChoiceOption {
	id: string; // stable, e.g. 'confirm' | 'edit' | 'discard'
	label: string; // display text
}

export interface InboundEnvelope {
	channel: Channel;
	externalId: string; // chat.id (Telegram) / phone number (WhatsApp) — raw, unresolved
	senderDisplayName?: string; // hint only (e.g. Telegram first_name), never authoritative
	messageId: string; // this message's own id, stringified
	replyToId: string | null; // stringified id of the message being replied to, if any
	timestamp: number; // unix millis
}

export type NormalizedInboundMessage = InboundEnvelope &
	(
		| { kind: "text"; text: string }
		| { kind: "image"; fileRef: string; caption?: string }
		| { kind: "document"; fileRef: string; filename?: string }
	);

export interface InboundParseFailure {
	channel: Channel;
	reason: string; // logged per EC-CH-02; router logs + 200s, never crashes the shared interface
}

// What the per-user actor hands back to the router for delivery (ticket 11+).
// The actor decides *what kind* of reply this is without touching a provider
// shape itself (ADR-0006 guardrail); the router is still the only thing that
// calls sendText/sendChoicePrompt.
export type OutboundAction =
	| { kind: "text"; text: string }
	| { kind: "choice"; text: string; options: ChoiceOption[] };

export interface MessagingProvider {
	sendText(to: string, text: string): Promise<void>;
	sendMediaPrompt(to: string, text: string): Promise<void>;
	sendChoicePrompt(
		to: string,
		text: string,
		options: ChoiceOption[],
	): Promise<void>;
	sendDocument(
		to: string,
		file: { bytes: ArrayBuffer; filename: string; mimeType: string },
		caption?: string,
	): Promise<void>;
	// Signature reserved per ADR-0004; unused in tracer #1 (§3.11 fog).
	sendLinkRequestCode(to: string, code: string): Promise<void>;
	receiveInboundMessage(
		rawPayload: unknown,
	): NormalizedInboundMessage | InboundParseFailure;
}
