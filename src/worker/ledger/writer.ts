import { toChartOfAccountsSlug } from "../parsing/category-mapping";
import type { CategorySlug } from "../parsing/types";
import { checkBalance, type JournalLineInput } from "./balance";
import { getCurrencyExponent, toMinorUnits } from "./currency";
import { uuidv7 } from "../lib/uuidv7";

export interface CommitTransactionInput {
	entryId: string; // DO-minted UUIDv7 (ADR-0002 §7) — the draft already has one
	userId: string;
	txnType: "income" | "expense";
	amountMajor: number;
	currency: string;
	category: CategorySlug;
	date: string; // 'YYYY-MM-DD'
	assetSlug: "cash" | "bank" | "ewallet";
	// Ticket 22: the user's raw text, stored verbatim — typos and personal notes
	// included, deliberately not normalized. null when unknown (drafts predating
	// 22 never stored it), which is also what pre-22 entries hold, so read paths
	// must handle NULL.
	description: string | null;
}

export type CommitTransactionResult =
	| { ok: true }
	| { ok: false; reason: string };

/**
 * Ticket 13: resolves the account pair by (user_id, slug), converts the
 * major-unit amount to minor units via currencies.exponent, runs the
 * app-layer balance check BEFORE any write, and commits journal_entries +
 * journal_lines in one D1 batch (ADR-0002 §1/§2/§3, FR-LDG-03).
 */
export async function commitTransaction(
	db: D1Database,
	input: CommitTransactionInput,
): Promise<CommitTransactionResult> {
	const categorySlug = toChartOfAccountsSlug(input.category, input.txnType);
	if (!categorySlug) {
		return { ok: false, reason: `no chart-of-accounts mapping for category "${input.category}"` };
	}

	const exponent = await getCurrencyExponent(db, input.currency);
	if (exponent === null) {
		return { ok: false, reason: `unknown currency "${input.currency}"` };
	}

	const [categoryAccount, assetAccount] = await Promise.all([
		db
			.prepare(`SELECT id, currency FROM accounts WHERE user_id = ? AND slug = ?`)
			.bind(input.userId, categorySlug)
			.first<{ id: string; currency: string | null }>(),
		db
			.prepare(`SELECT id, currency FROM accounts WHERE user_id = ? AND slug = ?`)
			.bind(input.userId, input.assetSlug)
			.first<{ id: string; currency: string | null }>(),
	]);

	if (!categoryAccount) {
		return { ok: false, reason: `account not found for slug "${categorySlug}"` };
	}
	if (!assetAccount) {
		return { ok: false, reason: `account not found for slug "${input.assetSlug}"` };
	}

	const amountMinor = toMinorUnits(input.amountMajor, exponent);

	// income: debit cash/bank/ewallet, credit the income category.
	// expense: debit the expense category, credit cash/bank/ewallet.
	const lines: (JournalLineInput & { accountId: string })[] =
		input.txnType === "income"
			? [
					{ accountId: assetAccount.id, direction: "debit", amountMinor, currency: input.currency },
					{ accountId: categoryAccount.id, direction: "credit", amountMinor, currency: input.currency },
				]
			: [
					{ accountId: categoryAccount.id, direction: "debit", amountMinor, currency: input.currency },
					{ accountId: assetAccount.id, direction: "credit", amountMinor, currency: input.currency },
				];

	// FR-LDG-03 balance check, app-layer, before any write.
	const balance = checkBalance(lines);
	if (!balance.ok) {
		return balance;
	}

	const now = Date.now();
	await db.batch([
		db
			.prepare(
				`INSERT INTO journal_entries (id, user_id, entry_date, description, source, currency, created_at)
				 VALUES (?, ?, ?, ?, 'text', ?, ?)`,
			)
			.bind(
				input.entryId,
				input.userId,
				input.date,
				input.description,
				input.currency,
				now,
			),
		...lines.map((line) =>
			db
				.prepare(
					`INSERT INTO journal_lines (id, user_id, entry_id, account_id, direction, amount_minor, currency)
					 VALUES (?, ?, ?, ?, ?, ?, ?)`,
				)
				.bind(
					uuidv7(),
					input.userId,
					input.entryId,
					line.accountId,
					line.direction,
					line.amountMinor,
					line.currency,
				),
		),
	]);

	return { ok: true };
}
