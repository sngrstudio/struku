// Detects which default asset account a transaction moved through, from
// keywords in the raw inbound text (e.g. "kopi 25rb via gopay" -> ewallet).
// ParseResult (ADR-0005) has no payment-method field — this is a deliberately
// simple, deterministic app-layer keyword match, not an AI extraction, so it
// stays outside ticket 12's already-committed parsing contract. Defaults to
// 'cash' when nothing more specific is stated.
const EWALLET_KEYWORDS = ["gopay", "ovo", "dana", "shopeepay", "e-wallet", "ewallet", "linkaja"];
const BANK_KEYWORDS = ["transfer", "bank", "debit", "rekening", "atm"];

export function detectAssetAccountSlug(text: string): "cash" | "bank" | "ewallet" {
	const normalized = text.toLowerCase();
	if (EWALLET_KEYWORDS.some((k) => normalized.includes(k))) return "ewallet";
	if (BANK_KEYWORDS.some((k) => normalized.includes(k))) return "bank";
	return "cash";
}
