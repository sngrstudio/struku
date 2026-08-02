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

export function categoryLabel(category: string, locale: Locale): string {
	return CATEGORY_LABELS[category]?.[locale] ?? category;
}

export function directionLabel(
	txnType: "income" | "expense",
	locale: Locale,
): string {
	if (txnType === "expense") return locale === "id" ? "Pengeluaran" : "Expense";
	return locale === "id" ? "Pemasukan" : "Income";
}

// Shared by ticket 12's plain-language reply and ticket 13's confirm prompt
// (spec: same "Pengeluaran Rp 25.000 — Makan" summary, just with or without
// the confirm/edit/discard choice attached).
export function transactionSummaryLine(
	txnType: "income" | "expense",
	amount: number,
	currency: string,
	category: string | null,
	date: string,
	locale: Locale,
): string {
	const direction = directionLabel(txnType, locale);
	const amountText = formatAmount(amount, currency);
	const categoryText = category
		? categoryLabel(category, locale)
		: locale === "id"
			? "Lainnya"
			: "Other";
	return `${direction} ${amountText} — ${categoryText} (${date})`;
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
 * Renders a ParseResult to a plain-language reply. As of ticket 13, the
 * Coordinator intercepts a clean transaction parse (amount + txn_type both
 * present) BEFORE calling this — that case starts a pending draft with a
 * confirm/edit/discard choice prompt instead (see Coordinator.handleTransaction
 * Message). This function still renders the clarification question, the
 * intent stubs, and the unknown/rephrase reply.
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

		const date = result.date ?? todayInTimezone(timezone);
		return {
			kind: "text",
			text: transactionSummaryLine(
				result.txn_type,
				result.amount,
				result.currency,
				result.category,
				date,
				locale,
			),
		};
	}

	if (result.intent === "unknown") {
		return { kind: "text", text: REPHRASE_REPLY[locale] };
	}

	return { kind: "text", text: STUB_REPLIES[result.intent][locale] };
}
