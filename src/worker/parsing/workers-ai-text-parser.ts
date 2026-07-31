import type { Locale } from "../onboarding/types";
import { PARSE_RESULT_JSON_SCHEMA, parseResultSchema } from "./schema";
import type { ParseResult, TextParser } from "./types";

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const MAX_TOKENS = 512; // ADR-0005 §2: 256 default truncates.

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

	async parse(text: string, locale: Locale): Promise<ParseResult> {
		const messages = [
			{ role: "system", content: systemPrompt(locale) },
			{ role: "user", content: text },
		];

		const first = await this.callModel(messages);
		const firstResult = tryParseResult(first);
		if (firstResult) return firstResult;

		// ADR-0005 §7: exactly one retry, same prompt plus a short error note.
		const retry = await this.callModel([
			...messages,
			{
				role: "user",
				content:
					"Your previous reply was not valid JSON matching the required schema. Reply again with ONLY the JSON object.",
			},
		]);
		const retryResult = tryParseResult(retry);
		if (retryResult) return retryResult;

		return UNKNOWN_REPHRASE_RESULT;
	}

	private async callModel(
		messages: { role: string; content: string }[],
	): Promise<string> {
		const output = await this.ai.run(MODEL, {
			messages,
			response_format: {
				type: "json_schema",
				json_schema: PARSE_RESULT_JSON_SCHEMA,
			},
			max_tokens: MAX_TOKENS,
		});

		if (typeof output === "string") return output;
		if ("response" in output && typeof output.response === "string") {
			return output.response;
		}
		return "";
	}
}
