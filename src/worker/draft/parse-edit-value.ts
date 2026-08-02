import { CATEGORY_SLUGS, type CategorySlug } from "../parsing/types";

// Minimal, deterministic parsers for the four editable draft fields (tracer
// #1 keeps edit to amount/category/date/direction on the pending draft — no
// AI re-parse, just direct value replacement per ticket 13).

const CATEGORY_ALIASES: Record<string, CategorySlug> = {
	makan: "food",
	food: "food",
	transportasi: "transport",
	transport: "transport",
	belanja: "shopping",
	shopping: "shopping",
	tagihan: "bills",
	bills: "bills",
	hiburan: "entertainment",
	entertainment: "entertainment",
	kesehatan: "health",
	health: "health",
	gaji: "salary",
	salary: "salary",
	freelance: "freelance",
	lainnya: "other",
	other: "other",
};

export function parseEditAmount(text: string): number | null {
	const normalized = text.trim().replace(/[.,\s]/g, "").toLowerCase();
	const match = normalized.match(/^(\d+(?:\.\d+)?)(rb|k|jt)?$/);
	if (!match) {
		const plain = Number(text.trim().replace(/[.,\s]/g, ""));
		return Number.isFinite(plain) && plain > 0 ? plain : null;
	}
	const [, numStr, unit] = match;
	const num = Number(numStr);
	if (!Number.isFinite(num) || num <= 0) return null;
	if (unit === "rb" || unit === "k") return num * 1000;
	if (unit === "jt") return num * 1000000;
	return num;
}

export function parseEditCategory(text: string): CategorySlug | null {
	const normalized = text.trim().toLowerCase();
	if ((CATEGORY_SLUGS as readonly string[]).includes(normalized)) {
		return normalized as CategorySlug;
	}
	return CATEGORY_ALIASES[normalized] ?? null;
}

export function parseEditDate(text: string): string | null {
	return /^\d{4}-\d{2}-\d{2}$/.test(text.trim()) ? text.trim() : null;
}

export function parseEditDirection(text: string): "income" | "expense" | null {
	const normalized = text.trim().toLowerCase();
	if (["pemasukan", "income", "masuk"].includes(normalized)) return "income";
	if (["pengeluaran", "expense", "keluar"].includes(normalized)) return "expense";
	return null;
}
