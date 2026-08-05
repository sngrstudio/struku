import { describe, expect, it } from "vitest";
import { RESPONSE_FORMAT_SCHEMAS } from "../src/worker/parsing/schema";

// Ticket 29 question 4, layer 1: the schema rule enforced by machine, locally
// and deterministically. Zero neurons, runs on every `npm test`.
//
// The rule (ticket 29 § Keputusan pertanyaan 1, to become ADR-0005 §3):
//
//   A schema sent to `response_format: json_schema` must be strict JSON Schema:
//   `type` always a single value, and unions — nullable included — expressed
//   with `anyOf`. `type` as an array and the OpenAPI `nullable: true` spelling
//   are both rejected by the platform with `5024`.
//
// That rule was found by probe, not documentation (probes #1 and #2, ticket 29
// runs 5 and 6) — Cloudflare's JSON Mode page lists no supported keywords at
// all. So nothing but this test stands between a well-meant schema edit and a
// production transaction path that silently stops recording.
//
// Layer 1 canNOT catch Cloudflare moving its validator; only `test:live` can,
// and that is a pre-deploy step, not a CI gate (ticket 29, deliberate).

type Violation = { path: string; rule: string };

/**
 * Walks a schema and reports every construct the platform rejects. Recursive on
 * purpose: the rule has to hold inside `properties`, inside `anyOf` branches,
 * and inside `items` — a violation nested three levels down fails the call just
 * as hard as one at the root.
 */
function findViolations(node: unknown, path = "$"): Violation[] {
	if (Array.isArray(node)) {
		return node.flatMap((child, index) =>
			findViolations(child, `${path}[${index}]`),
		);
	}
	if (node === null || typeof node !== "object") return [];

	const record = node as Record<string, unknown>;
	const violations: Violation[] = [];

	if (Array.isArray(record.type)) {
		violations.push({
			path: `${path}.type`,
			rule: "`type` must be a single value — express a union with `anyOf`",
		});
	}
	if ("nullable" in record) {
		violations.push({
			path: `${path}.nullable`,
			rule: "the OpenAPI `nullable` spelling is rejected — express null with `anyOf`",
		});
	}

	for (const [key, value] of Object.entries(record)) {
		violations.push(...findViolations(value, `${path}.${key}`));
	}
	return violations;
}

describe("response_format schema rules", () => {
	// Every REGISTERED schema. Ticket 29 question 4 asks this to bind both
	// calls; call-2 does not exist yet, so what is registered is the honest
	// limit of the guard: it checks the schemas listed, not the schemas sent.
	// A future call-2 that passes a schema literal without registering it here
	// is guarded by nothing — that is the gap to close when call-2 lands.
	for (const [name, schema] of Object.entries(RESPONSE_FORMAT_SCHEMAS)) {
		it(`${name} is strict JSON Schema`, () => {
			expect(findViolations(schema)).toEqual([]);
		});
	}

	// Without this, the loop above passes vacuously the day someone adds a
	// schema and forgets to register it — which is exactly the mistake the rule
	// exists to catch.
	it("has at least one registered schema to check", () => {
		expect(Object.keys(RESPONSE_FORMAT_SCHEMAS).length).toBeGreaterThan(0);
	});
});

// The checker is the load-bearing part, so it gets tested against the two
// constructs the probes actually saw rejected (ticket 29 runs 5 and 6: S4/S5
// for `type` arrays, N2/N5 for `nullable`).
describe("findViolations", () => {
	it("rejects `type` as an array (probe #1 S4: rejected with 5024)", () => {
		const schema = {
			type: "object",
			properties: { amount: { type: ["number", "null"] } },
		};

		expect(findViolations(schema)).toEqual([
			{ path: "$.properties.amount.type", rule: expect.any(String) },
		]);
	});

	it("rejects the OpenAPI `nullable` spelling (probe #2 N2: rejected with 5024)", () => {
		const schema = {
			type: "object",
			properties: { date: { type: "string", nullable: true } },
		};

		expect(findViolations(schema)).toEqual([
			{ path: "$.properties.date.nullable", rule: expect.any(String) },
		]);
	});

	it("rejects a violation nested inside an `anyOf` branch", () => {
		const schema = {
			type: "object",
			properties: {
				category: {
					anyOf: [{ type: ["string", "null"] }, { type: "null" }],
				},
			},
		};

		expect(findViolations(schema)).toEqual([
			{ path: "$.properties.category.anyOf[0].type", rule: expect.any(String) },
		]);
	});

	it("accepts the `anyOf` form the platform proved it takes (probe #2 N6)", () => {
		const schema = {
			type: "object",
			properties: {
				txn_type: {
					anyOf: [
						{ type: "string", enum: ["income", "expense"] },
						{ type: "null" },
					],
				},
			},
			required: ["txn_type"],
		};

		expect(findViolations(schema)).toEqual([]);
	});
});
