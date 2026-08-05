import { z } from "zod";
import { CATEGORY_SLUGS } from "./types";

// ADR-0005 §7: every response is JSON.parse'd AND Zod-validated — JSON mode is
// a strong prior, not a schema guarantee (#07 finding).
export const parseResultSchema = z.object({
	intent: z.enum(["transaction", "budget", "category", "query", "unknown"]),
	txn_type: z.enum(["income", "expense"]).nullable(),
	amount: z.number().positive().nullable(),
	currency: z.string().length(3),
	category: z.enum(CATEGORY_SLUGS).nullable(),
	// The contract is 'YYYY-MM-DD' or null, but the live model routinely
	// answers with a sentinel word ("unknown", "none", "") when no date was
	// stated, despite the prompt asking for null. Rejecting those threw away
	// otherwise-perfect parses, so anything that is not a well-formed date is
	// coerced to null here — the boundary absorbs the model's phrasing rather
	// than the whole result being discarded. A malformed *real* date still
	// lands as null, which reads downstream as "no date stated" and defaults
	// to today, exactly as an absent date would.
	date: z
		.string()
		.nullable()
		.transform((value) =>
			value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null,
		),
	clarification: z.string().nullable(),
});

// The JSON schema passed to response_format (ADR-0005 §1/§3): one flat object,
// intent required, everything else nullable — no nested sub-objects (the #05
// spike's load-bearing finding: nesting degenerated into a whitespace loop).
//
// Nullability is spelled with `anyOf`, and that spelling is load-bearing, not
// style. Cloudflare's json_schema validator wants strict JSON Schema: `type` a
// single value, unions via `anyOf`. The earlier `type: ["string","null"]` form
// (and the OpenAPI `nullable: true` form) are both rejected with
// `5024: JSON Model couldn't be met` — which took down the whole transaction
// path in production, 7/7 live tests failing across three conclusive runs.
// Neither form is mentioned by Cloudflare's docs in either direction; the rule
// came out of two isolation probes (ticket 29 runs 5 and 6), and
// test/response-format-schema-rules.test.ts is what keeps it from being undone
// by a well-meant edit.
export const PARSE_RESULT_JSON_SCHEMA = {
	type: "object",
	properties: {
		intent: {
			type: "string",
			enum: ["transaction", "budget", "category", "query", "unknown"],
		},
		txn_type: {
			anyOf: [{ type: "string", enum: ["income", "expense"] }, { type: "null" }],
		},
		amount: { anyOf: [{ type: "number" }, { type: "null" }] },
		currency: { type: "string" },
		category: {
			anyOf: [{ type: "string", enum: [...CATEGORY_SLUGS] }, { type: "null" }],
		},
		date: { anyOf: [{ type: "string" }, { type: "null" }] },
		clarification: { anyOf: [{ type: "string" }, { type: "null" }] },
	},
	required: ["intent", "txn_type", "amount", "currency", "category", "date", "clarification"],
} as const;

/**
 * Every JSON Schema this Worker hands to `response_format: json_schema`.
 *
 * Registered rather than checked one by one so the strict-JSON-Schema rule
 * (test/response-format-schema-rules.test.ts) binds BOTH calls — call-2's
 * reply-composition schema joins this map when it lands, and is covered the
 * moment it does.
 */
export const RESPONSE_FORMAT_SCHEMAS = {
	parseResult: PARSE_RESULT_JSON_SCHEMA,
} as const;
