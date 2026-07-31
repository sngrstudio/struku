import type { Locale } from "../onboarding/types";

export const CONFIRM_PROMPT_OPTIONS: Record<Locale, { id: string; label: string }[]> = {
	id: [
		{ id: "confirm", label: "Konfirmasi" },
		{ id: "edit", label: "Edit" },
		{ id: "discard", label: "Batal" },
	],
	en: [
		{ id: "confirm", label: "Confirm" },
		{ id: "edit", label: "Edit" },
		{ id: "discard", label: "Discard" },
	],
};

export const DRAFT_COPY: Record<
	Locale,
	{
		confirmQuestion: string;
		committed: string;
		discarded: string;
		editWhichField: string;
		editFieldRetry: string;
		askNewAmount: string;
		askNewCategory: string;
		askNewDate: string;
		askNewDirection: string;
		commitFailed: string;
	}
> = {
	id: {
		confirmQuestion: "Betul?",
		committed: "Sip, sudah dicatat!",
		discarded: "Oke, dibatalin ya.",
		editWhichField: "Mau ganti yang mana: jumlah, kategori, tanggal, atau jenis (masuk/keluar)?",
		editFieldRetry: "Aku belum ngerti — coba sebut: jumlah, kategori, tanggal, atau jenis.",
		askNewAmount: "Jumlahnya jadi berapa?",
		askNewCategory: "Kategorinya apa? (misal: makan, transportasi, belanja, tagihan, hiburan, kesehatan, gaji, freelance, lainnya)",
		askNewDate: "Tanggalnya kapan? (YYYY-MM-DD)",
		askNewDirection: "Ini pemasukan atau pengeluaran?",
		commitFailed: "Waduh, ada yang salah pas nyimpen. Coba kirim ulang transaksinya ya.",
	},
	en: {
		confirmQuestion: "Look good?",
		committed: "Saved!",
		discarded: "Okay, discarded.",
		editWhichField: "Which would you like to change: amount, category, date, or direction (income/expense)?",
		editFieldRetry: "I didn't catch that — try: amount, category, date, or direction.",
		askNewAmount: "What's the new amount?",
		askNewCategory: "What category? (e.g. food, transport, shopping, bills, entertainment, health, salary, freelance, other)",
		askNewDate: "What date? (YYYY-MM-DD)",
		askNewDirection: "Is this income or an expense?",
		commitFailed: "Something went wrong saving that. Please send the transaction again.",
	},
};
