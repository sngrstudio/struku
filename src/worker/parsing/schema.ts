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
	date: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.nullable(),
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
