import type { Locale } from "./types";

// Small, deliberately narrow parsers for onboarding free-text answers. No
// AI/NLP here — onboarding runs before any TextParser concern (ADR-0005 is
// transaction-parsing only), so these are simple pattern matches.

const AFFIRMATIVE = new Set([
	"ya",
	"iya",
	"yes",
	"setuju",
	"agree",
	"oke",
	"ok",
	"👍",
]);

export function isAffirmative(text: string): boolean {
	return AFFIRMATIVE.has(text.trim().toLowerCase());
}

export function parseLanguageChoice(text: string): Locale | null {
	const normalized = text.trim().toLowerCase();
	if (normalized === "id" || normalized.includes("indonesia")) return "id";
	if (normalized === "en" || normalized.includes("english")) return "en";
	return null;
}

// Common Indonesian timezone abbreviations, per PRD's WIB default and its two
// siblings (WITA/WIT) — not a full IANA-name parser.
const TIMEZONE_ALIASES: Record<string, string> = {
	wib: "Asia/Jakarta",
	wita: "Asia/Makassar",
	wit: "Asia/Jayapura",
};

export function parseTimezone(text: string): string | null {
	const normalized = text.trim().toLowerCase();
	if (normalized in TIMEZONE_ALIASES) return TIMEZONE_ALIASES[normalized];
	// Accept a literal IANA zone name (e.g. "Asia/Jakarta") if it round-trips.
	try {
		new Intl.DateTimeFormat("en-US", { timeZone: text.trim() });
		return text.trim();
	} catch {
		return null;
	}
}

export function parseCurrencyCode(text: string): string | null {
	const normalized = text.trim().toUpperCase();
	return /^[A-Z]{3}$/.test(normalized) ? normalized : null;
}
