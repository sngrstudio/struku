// ADR-0002 §1/§4/ADR-0005 §4: the model emits major/absolute units; the app
// owns the exponent conversion. IDR exponent 0 -> x1, USD exponent 2 -> x100.
export function toMinorUnits(amountMajor: number, exponent: number): number {
	return Math.round(amountMajor * 10 ** exponent);
}

// Inverse of toMinorUnits, for rendering a stored amount back to the user
// (ticket 23's daily total reads minor units out of journal_lines).
//
// DISPLAY ONLY — the result is a float, and ADR-0002 §1 keeps money in integer
// minor units precisely because floats are unsafe for it. Never feed the return
// value back into the ledger or into further arithmetic.
export function toMajorUnits(amountMinor: number, exponent: number): number {
	return amountMinor / 10 ** exponent;
}

export async function getCurrencyExponent(
	db: D1Database,
	code: string,
): Promise<number | null> {
	const row = await db
		.prepare(`SELECT exponent FROM currencies WHERE code = ?`)
		.bind(code)
		.first<{ exponent: number }>();
	return row?.exponent ?? null;
}
