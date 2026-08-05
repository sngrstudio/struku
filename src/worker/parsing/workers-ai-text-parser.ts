import type { Locale } from "../onboarding/types";
import {
	type NormalizedAiResponse,
	normalizeAiResponse,
} from "./normalize-ai-response";
import { PARSE_RESULT_JSON_SCHEMA, parseResultSchema } from "./schema";
import type { ParseOutcome, ParseResult, TextParser } from "./types";

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const MAX_TOKENS = 512; // ADR-0005 §2: 256 default truncates.

/** What one `ai.run` came back as: a payload to parse, or a call that failed. */
type ModelCallOutcome =
	| { kind: "text"; text: string }
	| { kind: "call_failed" };

// Narrow on purpose — assignable to both ModelCallOutcome and ParseOutcome, so
// a failed call reads the same at the call site and at the parse boundary.
const CALL_FAILED = { kind: "call_failed" } as const;

export const UNKNOWN_REPHRASE_RESULT: ParseResult = {
	intent: "unknown",
	txn_type: null,
	amount: null,
	currency: "IDR",
	category: null,
	date: null,
	clarification: null,
};

function systemPrompt(locale: Locale): string {
	// ADR-0005 §8: schema keys/instructions stay English, LOCALE is a
	// placeholder for the (not-yet-built) i18n resource layer — never
	// hardcoded to 'id'.
	return [
		"You extract structured data from a personal-finance chat message.",
		`The user's language is ${locale === "id" ? "Indonesian (id)" : "English (en)"}; write any "clarification" text in that language.`,
		"Classify intent as one of: transaction, budget, category, query, unknown.",
		"For a transaction: extract txn_type (income/expense), the absolute amount in major units",
		'(resolve shorthand like "25k"/"25rb" to 25000, "5jt" to 5000000, "1.5jt" to 1500000),',
		"the ISO-4217 currency (default IDR if not stated), a category slug, and a date",
		"('YYYY-MM-DD') only if one is explicitly stated (otherwise null).",
		"If an essential field (especially amount) is missing, set amount null and set",
		"clarification to a short question in the user's language asking for it. Never invent",
		"an amount the user did not state.",
	].join(" ");
}

/**
 * Parses one already-validated JSON string against the ParseResult contract.
 * Exported separately so the parse -> Zod -> retry wrapper is unit-testable
 * on canned strings without calling env.AI (ticket 12 requirement).
 */
export function tryParseResult(raw: string): ParseResult | null {
	let candidate: unknown;
	try {
		candidate = JSON.parse(raw);
	} catch {
		return null;
	}
	const result = parseResultSchema.safeParse(candidate);
	return result.success ? result.data : null;
}

export class WorkersAiTextParser implements TextParser {
	constructor(private readonly ai: Ai) {}

	async parse(text: string, locale: Locale): Promise<ParseOutcome> {
		const messages = [
			{ role: "system", content: systemPrompt(locale) },
			{ role: "user", content: text },
		];

		const first = await this.callModel(messages);
		if (first.kind === "call_failed") return CALL_FAILED;
		const firstResult = tryParseResult(first.text);
		if (firstResult) return { kind: "parsed", result: firstResult };

		// ADR-0005 §7: exactly one retry, same prompt plus a short error note.
		// This retry answers a BAD ANSWER, never a failed call — a call that
		// never landed is not made twice (ticket 29 question 2).
		const retry = await this.callModel([
			...messages,
			{
				role: "user",
				content:
					"Your previous reply was not valid JSON matching the required schema. Reply again with ONLY the JSON object.",
			},
		]);
		if (retry.kind === "call_failed") return CALL_FAILED;
		const retryResult = tryParseResult(retry.text);
		if (retryResult) return { kind: "parsed", result: retryResult };

		return { kind: "parsed", result: UNKNOWN_REPHRASE_RESULT };
	}

	/**
	 * One model call, reduced to a payload or a call failure. This is the ONLY
	 * place in the parse path that touches env.AI, so it is also the only place
	 * that has to know a call can fail: `ai.run` throws (5024, network, 5xx,
	 * model withdrawn) and nothing further up the message path catches — the
	 * AiError used to escape as an unhandled Durable Object exception and the
	 * user saw nothing at all, their message gone without a sound.
	 *
	 * Keeping the catch here is what lets the Coordinator stay ignorant of
	 * env.AI: the seam stays narrow instead of spraying try/catch downstream.
	 *
	 * A throw and an unreadable response shape are two different diagnoses, and
	 * they are logged apart even though they collapse to one class for the user
	 * — with production alerts deliberately declined (ticket 29 question 4),
	 * `wrangler tail` is the only place either becomes visible, and a silent
	 * catch would rebuild the very blind spot this change exists to close.
	 */
	private async callModel(
		messages: { role: string; content: string }[],
	): Promise<ModelCallOutcome> {
		let output: unknown;
		try {
			output = await this.ai.run(MODEL, {
				messages,
				response_format: {
					type: "json_schema",
					json_schema: PARSE_RESULT_JSON_SCHEMA,
				},
				max_tokens: MAX_TOKENS,
			});
		} catch (error) {
			console.error("parse: env.AI.run threw", error);
			return CALL_FAILED;
		}

		const normalized: NormalizedAiResponse = normalizeAiResponse(output);
		if (normalized.kind === "unrecognized") {
			console.error(
				"parse: unrecognized env.AI response shape",
				JSON.stringify(output)?.slice(0, 300),
			);
			return CALL_FAILED;
		}
		return normalized;
	}
}
