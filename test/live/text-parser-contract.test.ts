import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { WorkersAiTextParser } from "../../src/worker/parsing/workers-ai-text-parser";

// Ticket 12: NON-GATING live contract test against the real
// @cf/meta/llama-3.3-70b-instruct-fp8-fast model, seeded by the #05 spike
// battery (.scratch/struku-v1/research/05-parsing-spike/). Run via
// `npm run test:live` — never part of `npm test`. Costs real Workers AI
// neurons and needs live Cloudflare credentials (remoteBindings: true in
// vitest.live.config.ts).

describe("WorkersAiTextParser (live model contract)", () => {
	it("parses a clean English expense", async () => {
		const parser = new WorkersAiTextParser(env.AI);
		const result = await parser.parse("bought coffee 25k", "en");

		expect(result.intent).toBe("transaction");
		expect(result.txn_type).toBe("expense");
		expect(result.amount).toBe(25000);
		expect(result.currency).toBe("IDR");
	});

	it("resolves Indonesian 'rb' shorthand", async () => {
		const parser = new WorkersAiTextParser(env.AI);
		const result = await parser.parse("kopi 25rb", "id");

		expect(result.intent).toBe("transaction");
		expect(result.amount).toBe(25000);
	});

	it("resolves Indonesian 'jt' shorthand for income", async () => {
		const parser = new WorkersAiTextParser(env.AI);
		const result = await parser.parse("gaji masuk 5jt", "id");

		expect(result.intent).toBe("transaction");
		expect(result.txn_type).toBe("income");
		expect(result.amount).toBe(5000000);
	});

	it("keeps a foreign currency (USD) instead of converting to IDR", async () => {
		const parser = new WorkersAiTextParser(env.AI);
		const result = await parser.parse("bayar netflix 15 usd", "en");

		expect(result.intent).toBe("transaction");
		expect(result.currency).toBe("USD");
		expect(result.amount).toBe(15);
	});

	it("asks for clarification instead of inventing a missing amount (EC-TXT-01/02)", async () => {
		const parser = new WorkersAiTextParser(env.AI);
		const result = await parser.parse("jajan bakso tadi siang", "id");

		expect(result.amount).toBeNull();
		expect(result.clarification).toEqual(expect.any(String));
		expect(result.clarification?.length).toBeGreaterThan(0);
	});

	it("classifies a budget-setting message as intent=budget, not a transaction", async () => {
		const parser = new WorkersAiTextParser(env.AI);
		const result = await parser.parse("set budget makan 500rb", "id");

		expect(result.intent).toBe("budget");
	});

	it("classifies a reporting question as intent=query", async () => {
		const parser = new WorkersAiTextParser(env.AI);
		const result = await parser.parse("berapa pengeluaran bulan ini?", "id");

		expect(result.intent).toBe("query");
	});
});
