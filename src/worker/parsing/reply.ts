import type { Locale } from "../onboarding/types";
import type { OutboundAction } from "../messaging/types";
import { formatAmount } from "./format-amount";
import type { ParseResult } from "./types";

const CATEGORY_LABELS: Record<string, { id: string; en: string }> = {
	food: { id: "Makan", en: "Food" },
	transport: { id: "Transportasi", en: "Transport" },
	shopping: { id: "Belanja", en: "Shopping" },
	bills: { id: "Tagihan", en: "Bills" },
	entertainment: { id: "Hiburan", en: "Entertainment" },
	health: { id: "Kesehatan", en: "Health" },
	other: { id: "Lainnya", en: "Other" },
	salary: { id: "Gaji", en: "Salary" },
	freelance: { id: "Freelance", en: "Freelance" },
};

function categoryLabel(category: string, locale: Locale): string {
	return CATEGORY_LABELS[category]?.[locale] ?? category;
}

// Today in the user's timezone (spec: "date: null -> app fills
// today-in-user-timezone"); en-CA formats as YYYY-MM-DD directly, no date lib.
export function todayInTimezone(timezone: string): string {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: timezone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(new Date());
}

const STUB_REPLIES: Record<"budget" | "category" | "query", { id: string; en: string }> = {
	budget: {
		id: "Fitur atur budget belum tersedia — segera hadir ya!",
		en: "Budget tracking isn't built yet — coming soon!",
	},
	category: {
		id: "Fitur kategori custom belum tersedia — segera hadir ya!",
		en: "Custom categories aren't built yet — coming soon!",
	},
	query: {
		id: "Fitur laporan/pertanyaan belum tersedia — segera hadir ya!",
		en: "Reporting/queries aren't built yet — coming soon!",
	},
};

const REPHRASE_REPLY: Record<Locale, string> = {
	id: "Hmm, aku belum ngerti maksudnya. Coba tulis ulang ya?",
	en: "Hmm, I didn't quite get that. Could you rephrase?",
};

/**
 * Ticket 12: renders a ParseResult to a plain-language reply. Transaction
 * intent gets a summary of what was understood — no confirm/edit/discard
 * buttons and no ledger write (that's ticket 13's pending-draft/confirm flow,
 * built on top of this same ParseResult).
 */
export function buildParseReply(
	result: ParseResult,
	locale: Locale,
	timezone: string,
): OutboundAction {
	if (result.intent === "transaction") {
		if (result.amount === null || result.txn_type === null) {
			return {
				kind: "text",
				text:
					result.clarification ??
					(locale === "id"
						? "Boleh dijelasin lagi jumlahnya berapa?"
						: "Could you tell me the amount?"),
			};
		}

		const direction =
			result.txn_type === "expense"
				? locale === "id"
					? "Pengeluaran"
					: "Expense"
				: locale === "id"
					? "Pemasukan"
					: "Income";
		const amountText = formatAmount(result.amount, result.currency);
		const category = result.category
			? categoryLabel(result.category, locale)
			: locale === "id"
				? "Lainnya"
				: "Other";
		const date = result.date ?? todayInTimezone(timezone);

		return {
			kind: "text",
			text: `${direction} ${amountText} — ${category} (${date})`,
		};
	}

	if (result.intent === "unknown") {
		return { kind: "text", text: REPHRASE_REPLY[locale] };
	}

	return { kind: "text", text: STUB_REPLIES[result.intent][locale] };
}
