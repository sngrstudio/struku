import { describe, expect, it } from "vitest";
import {
	UNKNOWN_REPHRASE_RESULT,
	WorkersAiTextParser,
	tryParseResult,
} from "../src/worker/parsing/workers-ai-text-parser";

// Ticket 12: unit test for the parse -> Zod -> retry wrapper on canned JSON
// strings, no env.AI call — the retry orchestration itself lives in
// WorkersAiTextParser.parse and is exercised by the fake-TextParser webhook
// tests; this covers just tryParseResult's parse/validate step.

describe("tryParseResult", () => {
	it("accepts a well-formed clean-expense response", () => {
		const raw = JSON.stringify({
			intent: "transaction",
			txn_type: "expense",
			amount: 25000,
			currency: "IDR",
			category: "food",
			date: null,
			clarification: null,
		});

		expect(tryParseResult(raw)).toEqual({
			intent: "transaction",
			txn_type: "expense",
			amount: 25000,
			currency: "IDR",
			category: "food",
			date: null,
			clarification: null,
		});
	});

	it("accepts a missing-amount clarification response", () => {
		const raw = JSON.stringify({
			intent: "transaction",
			txn_type: "expense",
			amount: null,
			currency: "IDR",
			category: "food",
			date: null,
			clarification: "Berapa biaya jajan bakso tadi siang?",
		});

		const result = tryParseResult(raw);
		expect(result?.amount).toBeNull();
		expect(result?.clarification).toContain("Berapa");
	});

	it("returns null for broken JSON (triggers the retry path)", () => {
		expect(tryParseResult("{ this is not json")).toBeNull();
		expect(tryParseResult("\n\t\n\t\n\t")).toBeNull(); // #05 spike's whitespace-loop failure mode
	});

	it("returns null for JSON with an out-of-enum category", () => {
		const raw = JSON.stringify({
			intent: "transaction",
			txn_type: "expense",
			amount: 25000,
			currency: "IDR",
			category: "not_a_real_category",
			date: null,
			clarification: null,
		});

		expect(tryParseResult(raw)).toBeNull();
	});

	it("returns null when intent is missing (required field)", () => {
		const raw = JSON.stringify({
			txn_type: "expense",
			amount: 25000,
			currency: "IDR",
			category: "food",
			date: null,
			clarification: null,
		});

		expect(tryParseResult(raw)).toBeNull();
	});

	it("returns null for a negative or zero amount (never a valid transaction amount)", () => {
		const raw = JSON.stringify({
			intent: "transaction",
			txn_type: "expense",
			amount: 0,
			currency: "IDR",
			category: "food",
			date: null,
			clarification: null,
		});

		expect(tryParseResult(raw)).toBeNull();
	});

	it("accepts a non-transaction intent (budget/query/unknown) with null extraction fields", () => {
		const raw = JSON.stringify({
			intent: "query",
			txn_type: null,
			amount: null,
			currency: "IDR",
			category: null,
			date: null,
			clarification: null,
		});

		expect(tryParseResult(raw)?.intent).toBe("query");
	});

	// Regression: the live model answers a non-stated date with a sentinel
	// word rather than null. The date field used to be a strict regex, so a
	// parse that was correct in every other field was rejected outright and
	// the caller fell back to "please rephrase".
	it("coerces a non-date sentinel in `date` to null instead of rejecting", () => {
		const raw = JSON.stringify({
			intent: "transaction",
			txn_type: "expense",
			amount: 25000,
			currency: "IDR",
			category: "food",
			date: "unknown",
			clarification: null,
		});

		const result = tryParseResult(raw);
		expect(result).not.toBeNull();
		expect(result?.date).toBeNull();
		expect(result?.amount).toBe(25000);
	});

	it("still passes through a well-formed date", () => {
		const raw = JSON.stringify({
			intent: "transaction",
			txn_type: "expense",
			amount: 25000,
			currency: "IDR",
			category: "food",
			date: "2026-07-31",
			clarification: null,
		});

		expect(tryParseResult(raw)?.date).toBe("2026-07-31");
	});
});

// Regression: env.AI.run returns `.response` as an already-parsed object when
// called with response_format json_schema, but callModel only accepted the
// string form and returned "" for everything else. Every live parse therefore
// degraded to UNKNOWN_REPHRASE_RESULT while the model was answering correctly.
describe("WorkersAiTextParser.parse response-shape handling", () => {
	const wellFormed = {
		intent: "transaction",
		txn_type: "expense",
		amount: 25000,
		currency: "IDR",
		category: "food",
		date: null,
		clarification: null,
	};

	function parserReturning(response: unknown): WorkersAiTextParser {
		const fakeAi = {
			run: async () => ({ response }),
		} as unknown as Ai;
		return new WorkersAiTextParser(fakeAi);
	}

	it("reads an object-valued .response (json_schema mode)", async () => {
		const result = await parserReturning(wellFormed).parse("kopi 25rb", "id");

		expect(result.intent).toBe("transaction");
		expect(result.amount).toBe(25000);
	});

	it("still reads a string-valued .response", async () => {
		const result = await parserReturning(JSON.stringify(wellFormed)).parse(
			"kopi 25rb",
			"id",
		);

		expect(result.intent).toBe("transaction");
		expect(result.amount).toBe(25000);
	});

	it("falls back to the rephrase result when .response is unusable", async () => {
		const result = await parserReturning(null).parse("kopi 25rb", "id");

		expect(result).toEqual(UNKNOWN_REPHRASE_RESULT);
	});
});
