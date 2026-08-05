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
		const outcome = await parserReturning(wellFormed).parse("kopi 25rb", "id");

		expect(outcome).toEqual({
			kind: "parsed",
			result: expect.objectContaining({ intent: "transaction", amount: 25000 }),
		});
	});

	it("still reads a string-valued .response", async () => {
		const outcome = await parserReturning(JSON.stringify(wellFormed)).parse(
			"kopi 25rb",
			"id",
		);

		expect(outcome).toEqual({
			kind: "parsed",
			result: expect.objectContaining({ intent: "transaction", amount: 25000 }),
		});
	});

	// Call-1 goes through the SAME normalization boundary as call-2, so the
	// OpenAI chat-completion shape must work here too — proof the boundary is
	// shared rather than merely written (ticket 29 question 5).
	it("reads the OpenAI chat-completion shape through the shared boundary", async () => {
		const fakeAi = {
			run: async () => ({
				choices: [{ message: { content: JSON.stringify(wellFormed) } }],
			}),
		} as unknown as Ai;

		const outcome = await new WorkersAiTextParser(fakeAi).parse("kopi 25rb", "id");

		expect(outcome).toEqual({
			kind: "parsed",
			result: expect.objectContaining({ intent: "transaction", amount: 25000 }),
		});
	});
});

// Ticket 29 question 2: a CALL that failed and a MESSAGE that could not be
// parsed are two different things, and the boundary that knows the difference
// is this one. Merging them makes "the AI is down" wear the mask of "I didn't
// understand you", so the user rewrites a fine message, fails again, and blames
// themselves for a system fault — while every attempt burns neurons.
describe("WorkersAiTextParser.parse call-failure handling", () => {
	it("reports a thrown ai.run as a call failure, not as a parse failure", async () => {
		const fakeAi = {
			run: async () => {
				throw new Error("AiError: 5024: JSON Model couldn't be met");
			},
		} as unknown as Ai;

		const outcome = await new WorkersAiTextParser(fakeAi).parse("kopi 25rb", "id");

		expect(outcome).toEqual({ kind: "call_failed" });
	});

	// ADR-0005 §7's single retry is for a model that answered badly. A call that
	// never landed is a different fault and must not be paid for twice — the
	// two retry policies stay unmixed (ticket 29, question 2).
	it("does not retry a thrown call", async () => {
		let calls = 0;
		const fakeAi = {
			run: async () => {
				calls += 1;
				throw new Error("Network connection lost");
			},
		} as unknown as Ai;

		await new WorkersAiTextParser(fakeAi).parse("kopi 25rb", "id");

		expect(calls).toBe(1);
	});

	// The shape ticket 29 question 5 is really about: nothing threw, the binding
	// simply spoke a dialect this code does not read. Previously it collapsed to
	// "" and left production silently unable to record.
	it("reports an unrecognized response shape as a call failure", async () => {
		const fakeAi = {
			run: async () => ({ output_text: "surprise" }),
		} as unknown as Ai;

		const outcome = await new WorkersAiTextParser(fakeAi).parse("kopi 25rb", "id");

		expect(outcome).toEqual({ kind: "call_failed" });
	});

	// A recognized shape with an unparseable payload is the model's fault, so it
	// keeps the old behaviour exactly: one retry, then the rephrase result.
	it("still retries and falls back to the rephrase result when the model answers badly", async () => {
		let calls = 0;
		const fakeAi = {
			run: async () => {
				calls += 1;
				return { response: "not json at all" };
			},
		} as unknown as Ai;

		const outcome = await new WorkersAiTextParser(fakeAi).parse("kopi 25rb", "id");

		expect(outcome).toEqual({ kind: "parsed", result: UNKNOWN_REPHRASE_RESULT });
		expect(calls).toBe(2);
	});
});
