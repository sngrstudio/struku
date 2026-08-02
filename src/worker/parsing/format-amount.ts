// Renders the AI's major-unit amount back to the user for confirmation
// (spec user story #15: "Rp 25.000", not "25k") — display formatting only;
// the minor-unit conversion for the ledger (ADR-0005 §4) is a separate,
// not-yet-built step (ticket 13).
const CURRENCY_SYMBOLS: Record<string, string> = {
	IDR: "Rp",
	USD: "$",
};

export function formatAmount(amount: number, currency: string): string {
	const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
	const formatted = new Intl.NumberFormat("id-ID").format(amount);
	return `${symbol} ${formatted}`;
}
