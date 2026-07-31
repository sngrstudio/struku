import { describe, expect, it } from "vitest";
import { tryParseResult } from "../src/worker/parsing/workers-ai-text-parser";

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
});
