// ADR-0002 §1/§4/ADR-0005 §4: the model emits major/absolute units; the app
// owns the exponent conversion. IDR exponent 0 -> x1, USD exponent 2 -> x100.
export function toMinorUnits(amountMajor: number, exponent: number): number {
	return Math.round(amountMajor * 10 ** exponent);
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
