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
export const PARSE_RESULT_JSON_SCHEMA = {
	type: "object",
	properties: {
		intent: {
			type: "string",
			enum: ["transaction", "budget", "category", "query", "unknown"],
		},
		txn_type: { type: ["string", "null"], enum: ["income", "expense", null] },
		amount: { type: ["number", "null"] },
		currency: { type: "string" },
		category: {
			type: ["string", "null"],
			enum: [...CATEGORY_SLUGS, null],
		},
		date: { type: ["string", "null"] },
		clarification: { type: ["string", "null"] },
	},
	required: ["intent", "txn_type", "amount", "currency", "category", "date", "clarification"],
} as const;
