import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { PARSE_RESULT_JSON_SCHEMA } from "../../src/worker/parsing/schema";

// Ticket 29 probe — TEMPORARY. Delete once the culprit construct is recorded in
// .scratch/struku-daily/issues/29-parse-schema-5024.md.
//
// Non-gating: test/live/** is excluded from `npm test` (vitest.config.ts) and
// only runs via `npm run test:live`. Needs live Cloudflare credentials and burns
// real Workers AI neurons. It releases nothing, so it sits outside the freeze.
//
// WHY THIS EXISTS
// `text-parser-contract.test.ts` fails 7/7 against the live model with
// `AiError: 5024: JSON Model couldn't be met`, reproduced across three
// conclusive runs, while the ticket-25 probe passes on the SAME model in the
// SAME session through the SAME response_format mechanism. So the schema shape
// is the variable — but the two schemas differ in FOUR ways at once (field
// count, union `type` arrays, `enum`, `enum` containing null), so "the schema is
// rejected" is as far as the evidence goes. It does not say WHICH construct.
//
// This probe changes ONE thing at a time from the known-good shape. The first
// step that fails names the culprit. Steps are deliberately ordered so that each
// adds a single construct on top of S1.
//
// The reporter swallows console.log — the transcript comes out through a
// deliberately failing assertion at the end.

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const MAX_TOKENS = 512; // same as workers-ai-text-parser.ts, so it is not a variable

// The same task the failing contract test asks for, so the prompt is not a
// variable either — only the schema changes between steps.
const SYSTEM = [
	"You extract structured data from a personal-finance chat message.",
	"Classify intent as one of: transaction, budget, category, query, unknown.",
	"For a transaction: extract txn_type (income/expense), the absolute amount in",
	"major units, the ISO-4217 currency, a category slug, and a date if stated.",
].join(" ");
const USER = "bought coffee 25k";

type Step = {
	id: string;
	construct: string;
	schema: Record<string, unknown>;
};

// S1 is the known-good control (ticket 25's probe shape). S8 is the known-bad
// control (the real thing). Everything between adds exactly one construct to S1.
const STEPS: Step[] = [
	{
		id: "S1",
		construct: "CONTROL: two plain strings (ticket 25 probe shape — known good)",
		schema: {
			type: "object",
			properties: { reply: { type: "string" }, summary: { type: "string" } },
			required: ["reply", "summary"],
		},
	},
	{
		id: "S2",
		construct: "field count only: 7 plain strings, no enum, no unions",
		schema: {
			type: "object",
			properties: {
				intent: { type: "string" },
				txn_type: { type: "string" },
				amount: { type: "string" },
				currency: { type: "string" },
				category: { type: "string" },
				date: { type: "string" },
				clarification: { type: "string" },
			},
			required: [
				"intent",
				"txn_type",
				"amount",
				"currency",
				"category",
				"date",
				"clarification",
			],
		},
	},
	{
		id: "S3",
		construct: "plain enum (no null, no union type)",
		schema: {
			type: "object",
			properties: {
				intent: {
					type: "string",
					enum: ["transaction", "budget", "category", "query", "unknown"],
				},
				summary: { type: "string" },
			},
			required: ["intent", "summary"],
		},
	},
	{
		id: "S4",
		construct: 'union type ["string","null"] (no enum)',
		schema: {
			type: "object",
			properties: {
				clarification: { type: ["string", "null"] },
				summary: { type: "string" },
			},
			required: ["clarification", "summary"],
		},
	},
	{
		id: "S5",
		construct: 'union type ["number","null"] (numeric union, no enum)',
		schema: {
			type: "object",
			properties: {
				amount: { type: ["number", "null"] },
				summary: { type: "string" },
			},
			required: ["amount", "summary"],
		},
	},
	{
		id: "S6",
		construct: "PRIME SUSPECT: union type + enum CONTAINING null",
		schema: {
			type: "object",
			properties: {
				txn_type: {
					type: ["string", "null"],
					enum: ["income", "expense", null],
				},
				summary: { type: "string" },
			},
			required: ["txn_type", "summary"],
		},
	},
	{
		id: "S7",
		construct: "same as S6 but null dropped from the enum (does removing null fix it?)",
		schema: {
			type: "object",
			properties: {
				txn_type: { type: ["string", "null"], enum: ["income", "expense"] },
				summary: { type: "string" },
			},
			required: ["txn_type", "summary"],
		},
	},
	{
		id: "S8",
		construct:
			"CONTROL: the real PARSE_RESULT_JSON_SCHEMA (ADR-0005 §3 — known bad)",
		schema: PARSE_RESULT_JSON_SCHEMA as unknown as Record<string, unknown>,
	},
];

type Outcome = {
	id: string;
	construct: string;
	ms: number;
	verdict: "OK" | "REJECTED" | "HUNG/OTHER";
	detail: string;
};

const outcomes: Outcome[] = [];

describe("ticket 29: which JSON Schema construct triggers 5024", () => {
	for (const step of STEPS) {
		it(`${step.id} — ${step.construct}`, async () => {
			const started = Date.now();
			let verdict: Outcome["verdict"] = "OK";
			let detail = "";
			try {
				const output = await env.AI.run(MODEL as Parameters<Ai["run"]>[0], {
					messages: [
						{ role: "system", content: SYSTEM },
						{ role: "user", content: USER },
					],
					response_format: { type: "json_schema", json_schema: step.schema },
					max_tokens: MAX_TOKENS,
				} as Parameters<Ai["run"]>[1]);
				// The payload itself does not matter here — only whether the call is
				// accepted. A truncated echo is kept purely to spot a step that
				// "succeeds" with a degenerate answer.
				detail = JSON.stringify(output)?.slice(0, 160) ?? "(no payload)";
			} catch (error) {
				const message =
					error instanceof Error ? error.message : String(error);
				verdict = message.includes("5024") ? "REJECTED" : "HUNG/OTHER";
				detail = message;
			}
			outcomes.push({
				id: step.id,
				construct: step.construct,
				ms: Date.now() - started,
				verdict,
				detail,
			});

			// Never gate: a rejected step is the finding, not a broken build.
			expect(outcomes.length).toBeGreaterThan(0);
		}, 45_000); // above the 20s wall the contract test keeps hitting
	}

	it("PRINTS THE TRANSCRIPT — this failure is the report, not a bug", () => {
		const report = outcomes
			.map(
				(o) =>
					`${o.id}  ${o.verdict.padEnd(11)} ${String(o.ms).padStart(6)}ms  ${o.construct}\n      ${o.detail}`,
			)
			.join("\n");
		expect(report).toBe("READ THE ACTUAL VALUE ABOVE");
	});
});
