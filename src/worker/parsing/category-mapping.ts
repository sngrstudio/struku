import type { CategorySlug } from "./types";

// The model emits the short, spike-proven slugs (ADR-0005 §5); the chart of
// accounts (chart-of-accounts.ts, ADR-0002 §5) uses longer prefixed slugs.
// This is the one deterministic (user_id, slug) mapping step between them —
// no fuzzy matching, since both sides are closed enums.
const EXPENSE_SLUGS: Record<Exclude<CategorySlug, "salary" | "freelance">, string> = {
	food: "expense_food",
	transport: "expense_transportation",
	shopping: "expense_shopping",
	bills: "expense_bills_utilities",
	entertainment: "expense_entertainment",
	health: "expense_healthcare",
	other: "expense_other",
};

const INCOME_SLUGS: Record<"salary" | "freelance" | "other", string> = {
	salary: "income_salary",
	freelance: "income_freelance",
	other: "income_other",
};

export function toChartOfAccountsSlug(
	category: CategorySlug,
	txnType: "income" | "expense",
): string | null {
	if (txnType === "income") {
		return category in INCOME_SLUGS
			? INCOME_SLUGS[category as keyof typeof INCOME_SLUGS]
			: null;
	}
	return category in EXPENSE_SLUGS
		? EXPENSE_SLUGS[category as keyof typeof EXPENSE_SLUGS]
		: null;
}
