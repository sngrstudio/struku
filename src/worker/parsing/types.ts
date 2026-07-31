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

export interface TextParser {
	parse(text: string, locale: Locale): Promise<ParseResult>;
}
