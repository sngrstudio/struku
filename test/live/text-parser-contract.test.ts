import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { ParseResult } from "../../src/worker/parsing/types";
import { WorkersAiTextParser } from "../../src/worker/parsing/workers-ai-text-parser";

// Ticket 12: NON-GATING live contract test against the real
// @cf/meta/llama-3.3-70b-instruct-fp8-fast model, seeded by the #05 spike
// battery (.scratch/struku-v1/research/05-parsing-spike/). Run via
// `npm run test:live` — never part of `npm test`. Costs real Workers AI
// neurons and needs live Cloudflare credentials (remoteBindings: true in
// vitest.live.config.ts).
//
// Ticket 29 makes this the MANDATORY pre-deploy step (question 4, layer 2) —
// deliberately not a CI gate, since a gate that reddens because a third-party
// model was slow gets trained away. This is the only check in the repo that can
// see Cloudflare move its json_schema validator under us: every other test
// injects a fake TextParser above env.AI and never touches the real contract.

/**
 * Unwraps the outcome, failing loudly if the call itself did not land.
 *
 * This is the detector for the `5024` class. A platform rejection now surfaces
 * as `call_failed` rather than a thrown AiError, so without this assertion the
 * exact failure that took production down would read as a merely disappointing
 * parse.
 */
async function parseOrFail(text: string, locale: "id" | "en"): Promise<ParseResult> {
	const parser = new WorkersAiTextParser(env.AI);
	const outcome = await parser.parse(text, locale);
	if (outcome.kind === "call_failed") {
		throw new Error(
			`call_failed for ${JSON.stringify(text)} — the model call did not land. ` +
				"If this is the whole battery, suspect the response_format schema (5024).",
		);
	}
	return outcome.result;
}

describe("WorkersAiTextParser (live model contract)", () => {
	it("parses a clean English expense", async () => {
		const result = await parseOrFail("bought coffee 25k", "en");

		expect(result.intent).toBe("transaction");
		expect(result.txn_type).toBe("expense");
		expect(result.amount).toBe(25000);
		expect(result.currency).toBe("IDR");
	});

	it("resolves Indonesian 'rb' shorthand", async () => {
		const result = await parseOrFail("kopi 25rb", "id");

		expect(result.intent).toBe("transaction");
		expect(result.amount).toBe(25000);
	});

	it("resolves Indonesian 'jt' shorthand for income", async () => {
		const result = await parseOrFail("gaji masuk 5jt", "id");

		expect(result.intent).toBe("transaction");
		expect(result.txn_type).toBe("income");
		expect(result.amount).toBe(5000000);
	});

	it("keeps a foreign currency (USD) instead of converting to IDR", async () => {
		const result = await parseOrFail("bayar netflix 15 usd", "en");

		expect(result.intent).toBe("transaction");
		expect(result.currency).toBe("USD");
		expect(result.amount).toBe(15);
	});

	it("asks for clarification instead of inventing a missing amount (EC-TXT-01/02)", async () => {
		const result = await parseOrFail("jajan bakso tadi siang", "id");

		expect(result.amount).toBeNull();
		expect(result.clarification).toEqual(expect.any(String));
		expect(result.clarification?.length).toBeGreaterThan(0);
	});

	it("classifies a budget-setting message as intent=budget, not a transaction", async () => {
		const result = await parseOrFail("set budget makan 500rb", "id");

		expect(result.intent).toBe("budget");
	});

	it("classifies a reporting question as intent=query", async () => {
		const result = await parseOrFail("berapa pengeluaran bulan ini?", "id");

		expect(result.intent).toBe("query");
	});
});
