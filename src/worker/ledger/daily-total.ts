import { toMajorUnits } from "./currency";

/**
 * Ticket 23 part B: the day's expense total in MAJOR units, shown once after
 * a commit.
 *
 * Deliberately NOT a reporting surface (ticket 16) — it is one number for one
 * day, in one currency. Its shape was decided in grilling:
 *
 * - "today" means `entry_date` (the accounting date), not `created_at`, so a
 *   backdated entry counts on its own day rather than the day it was typed;
 * - expenses only, never net — income does not reduce it;
 * - single-currency: only the committed transaction's currency is summed.
 *   A same-day expense in another currency is silently out of scope (option A
 *   plain, chosen knowingly — ADR-0002 keeps FX in the reporting path, which
 *   does not exist yet).
 *
 * Two traps from research 14 are load-bearing here:
 * (b) filtering on `direction = 'debit'` alone would also catch the cash leg of
 *     an income entry, so the expense side is identified via `accounts.type`;
 * (c) `status` must be filtered or reversals double-count once ticket 17 lands.
 *
 * Trap (a) is NOT handled here and cannot be: without `PRAGMA optimize` the
 * planner ignores idx_journal_entries_user_date. That is ticket 20, still open.
 *
 * Every joined user-scoped table carries its own `user_id = ?` (ADR-0002 §7:
 * no "except when JOINed" exception — journal_lines.user_id is denormalized
 * for exactly this). It also keeps the user_id-leading indexes usable.
 */
export async function sumExpensesOnDate(
	db: D1Database,
	userId: string,
	date: string, // 'YYYY-MM-DD', matched against entry_date
	currency: string,
): Promise<number> {
	// The exponent is resolved in the same query rather than by a second
	// round-trip: this runs on the daily write path, right after the commit.
	// Returning major units keeps the float conversion (display-only — ADR-0002
	// §1 keeps money in integer minor units everywhere else) in one place.
	const row = await db
		.prepare(
			`SELECT COALESCE(SUM(jl.amount_minor), 0) AS total_minor,
			        (SELECT exponent FROM currencies WHERE code = ?) AS exponent
			 FROM journal_lines jl
			 JOIN journal_entries je ON je.id = jl.entry_id
			 JOIN accounts a ON a.id = jl.account_id
			 WHERE jl.user_id = ?
			   AND je.user_id = ?
			   AND a.user_id = ?
			   AND je.entry_date = ?
			   AND je.currency = ?
			   AND je.status = 'posted'
			   AND a.type = 'expense'
			   AND jl.direction = 'debit'`,
		)
		.bind(currency, userId, userId, userId, date, currency)
		.first<{ total_minor: number; exponent: number | null }>();

	// An unknown currency cannot reach here — commitTransaction rejects it
	// before the write (writer.ts) — so a null exponent means the currencies
	// row vanished; report 0 rather than a mis-scaled number.
	if (!row || row.exponent === null) return 0;
	return toMajorUnits(row.total_minor, row.exponent);
}
