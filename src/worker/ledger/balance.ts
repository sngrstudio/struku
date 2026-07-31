export interface JournalLineInput {
	direction: "debit" | "credit";
	amountMinor: number;
	currency: string;
}

export type BalanceCheckResult = { ok: true } | { ok: false; reason: string };

/**
 * FR-LDG-03, app-layer, before any D1 write (ADR-0002 §2/§3): at least two
 * lines, all lines share one currency, SUM(debit) == SUM(credit),
 * integer-exact. A standalone, directly-testable function — the writer's
 * happy path only ever builds already-balanced 2-line sets, so this is what
 * actually exercises the rejection path.
 */
export function checkBalance(lines: JournalLineInput[]): BalanceCheckResult {
	if (lines.length < 2) {
		return { ok: false, reason: "an entry needs at least two lines" };
	}

	const currencies = new Set(lines.map((l) => l.currency));
	if (currencies.size > 1) {
		return { ok: false, reason: "all lines must share the entry currency" };
	}

	const debitTotal = lines
		.filter((l) => l.direction === "debit")
		.reduce((sum, l) => sum + l.amountMinor, 0);
	const creditTotal = lines
		.filter((l) => l.direction === "credit")
		.reduce((sum, l) => sum + l.amountMinor, 0);

	if (debitTotal !== creditTotal) {
		return {
			ok: false,
			reason: `unbalanced entry: debit ${debitTotal} != credit ${creditTotal}`,
		};
	}

	return { ok: true };
}
