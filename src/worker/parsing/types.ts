import type { Locale } from "../onboarding/types";

// ADR-0005: flat contract, intent required, everything else nullable.
// Category is the SHORT spike-proven slug (food, transport, ...), not the
// chart-of-accounts' prefixed slug — see category-mapping.ts for that step.
export const CATEGORY_SLUGS = [
	"food",
	"transport",
	"shopping",
	"bills",
	"entertainment",
	"health",
	"other",
	"salary",
	"freelance",
] as const;
export type CategorySlug = (typeof CATEGORY_SLUGS)[number];

export interface ParseResult {
	intent: "transaction" | "budget" | "category" | "query" | "unknown";
	txn_type: "income" | "expense" | null;
	amount: number | null; // major/absolute units; app converts to minor later
	currency: string; // ISO-4217, default 'IDR'
	category: CategorySlug | null;
	date: string | null; // 'YYYY-MM-DD'; null -> app fills today-in-user-timezone
	clarification: string | null; // in the user's language when a field is missing
}

/**
 * The two outcomes of asking the model to read a message, kept apart on purpose
 * (ADR-0005 §6; ticket 29 question 2).
 *
 * `call_failed` means the call itself did not land — it threw, or the binding
 * answered in a shape this code cannot read. `parsed` means the call landed and
 * the result is whatever the model said, INCLUDING a result that means "I could
 * not make sense of this" (UNKNOWN_REPHRASE_RESULT).
 *
 * Collapsing the two lets a broken system say "I didn't understand you", which
 * makes the user rewrite a message that was never at fault. A union rather than
 * a sentinel value so the compiler, not a convention, keeps them apart.
 */
export type ParseOutcome =
	| { kind: "parsed"; result: ParseResult }
	| { kind: "call_failed" };

export interface TextParser {
	parse(text: string, locale: Locale): Promise<ParseOutcome>;
}
