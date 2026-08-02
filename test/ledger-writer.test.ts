import { describe, expect, it } from "vitest";
import { checkBalance } from "../src/worker/ledger/balance";
import { toMinorUnits } from "../src/worker/ledger/currency";

// Ticket 13: unit tests for major->minor conversion and balance rejection,
// independent of D1 (the writer's D1-touching path is exercised through the
// webhook seam in test/ledger-webhook.test.ts).

describe("toMinorUnits", () => {
	it("IDR (exponent 0): x1", () => {
		expect(toMinorUnits(25000, 0)).toBe(25000);
	});

	it("USD (exponent 2): x100", () => {
		expect(toMinorUnits(15, 2)).toBe(1500);
		expect(toMinorUnits(15.5, 2)).toBe(1550);
	});

	it("rounds to the nearest minor unit to avoid float drift", () => {
		expect(toMinorUnits(19.999, 2)).toBe(2000);
	});
});

describe("checkBalance", () => {
	it("accepts a balanced 2-line entry", () => {
		const result = checkBalance([
			{ direction: "debit", amountMinor: 25000, currency: "IDR" },
			{ direction: "credit", amountMinor: 25000, currency: "IDR" },
		]);
		expect(result).toEqual({ ok: true });
	});

	it("rejects an entry with fewer than 2 lines", () => {
		const result = checkBalance([
			{ direction: "debit", amountMinor: 25000, currency: "IDR" },
		]);
		expect(result.ok).toBe(false);
	});

	it("rejects lines that don't share the entry currency", () => {
		const result = checkBalance([
			{ direction: "debit", amountMinor: 25000, currency: "IDR" },
			{ direction: "credit", amountMinor: 25000, currency: "USD" },
		]);
		expect(result.ok).toBe(false);
	});

	it("rejects an unbalanced debit/credit total (FR-LDG-03)", () => {
		const result = checkBalance([
			{ direction: "debit", amountMinor: 25000, currency: "IDR" },
			{ direction: "credit", amountMinor: 20000, currency: "IDR" },
		]);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toContain("unbalanced");
	});

	it("accepts a balanced entry with more than 2 lines", () => {
		const result = checkBalance([
			{ direction: "debit", amountMinor: 15000, currency: "IDR" },
			{ direction: "debit", amountMinor: 10000, currency: "IDR" },
			{ direction: "credit", amountMinor: 25000, currency: "IDR" },
		]);
		expect(result).toEqual({ ok: true });
	});
});
