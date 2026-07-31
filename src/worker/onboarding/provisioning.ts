import { DEFAULT_CHART_OF_ACCOUNTS } from "../ledger/chart-of-accounts";
import { uuidv7 } from "../lib/uuidv7";
import type { OnboardingAnswers } from "./types";

// FR-ONB-04/ADR-0003 §6: seeds the default chart of accounts and marks
// onboarding complete in the same write. onboarding_completed_at is the one
// piece of onboarding status queryable outside the actor (router's guard).
export async function provisionUser(
	db: D1Database,
	userId: string,
	answers: OnboardingAnswers,
): Promise<void> {
	const now = Date.now();
	const primaryCurrency = answers.currency ?? "IDR";

	const accountInserts = DEFAULT_CHART_OF_ACCOUNTS.map((entry) =>
		db
			.prepare(
				`INSERT INTO accounts (id, user_id, slug, type, name, currency, is_default, created_at)
				 VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
			)
			.bind(
				uuidv7(),
				userId,
				entry.slug,
				entry.type,
				entry.defaultName,
				entry.currency === "primary" ? primaryCurrency : null,
				now,
			),
	);

	await db.batch([
		db
			.prepare(
				`UPDATE users
				 SET display_name = ?, primary_currency = ?, locale = ?, timezone = ?, onboarding_completed_at = ?
				 WHERE id = ?`,
			)
			.bind(
				answers.displayName,
				primaryCurrency,
				answers.locale === "en" ? "en-US" : "id-ID",
				answers.timezone ?? "Asia/Jakarta",
				now,
				userId,
			),
		...accountInserts,
	]);
}

export async function isValidCurrencyCode(
	db: D1Database,
	code: string,
): Promise<boolean> {
	const row = await db
		.prepare(`SELECT 1 FROM currencies WHERE code = ?`)
		.bind(code)
		.first();
	return row !== null;
}
