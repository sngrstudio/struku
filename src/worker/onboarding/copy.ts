import type { Locale } from "./types";

// Minimal locale bundle for onboarding copy (no full i18n resource layer yet —
// spec Out of Scope). Plain-language, no accounting jargon (NFR-USE-02).

export const DEFAULT_CURRENCY = "IDR";
export const DEFAULT_TIMEZONE = "Asia/Jakarta"; // WIB

interface OnboardingCopy {
	consent: string;
	consentRetry: string;
	askDisplayName: string;
	askCurrency: string;
	askCurrencyRetry: string;
	askTimezone: string;
	askTimezoneRetry: string;
	summary: (a: {
		displayName: string;
		currency: string;
		timezone: string;
	}) => string;
	summaryRetry: string;
	provisioned: string;
	editWhichField: string;
}

const id: OnboardingCopy = {
	consent:
		"Sebelum lanjut: Struku bakal nyimpen data pribadi & transaksi kamu buat nyatet keuangan kamu. Setuju?",
	consentRetry:
		"Aku butuh jawaban ya/tidak yang jelas dulu sebelum lanjut. Setuju sama pengumpulan data ini?",
	askDisplayName: "Enaknya aku panggil kamu siapa?",
	askCurrency: `Mata uang buat catatan kamu pake ${DEFAULT_CURRENCY} aja ya? Atau mau ganti?`,
	askCurrencyRetry: "Coba sebutin kode mata uang 3 huruf, misal IDR atau USD.",
	askTimezone: `Zona waktu kamu WIB (${DEFAULT_TIMEZONE}) aja ya? Atau beda?`,
	askTimezoneRetry:
		"Coba sebutin zona waktu kamu, misal WIB, WITA, atau WIT.",
	summary: ({ displayName, currency, timezone }) =>
		`Oke, cek dulu ya:\nNama: ${displayName}\nMata uang: ${currency}\nZona waktu: ${timezone}\n\nUdah bener?`,
	summaryRetry: "Mau confirm atau edit dulu nih?",
	provisioned:
		"Semua beres! Akun kamu udah siap. Coba deh kirim transaksi pertama, misal \"kopi 25rb\".",
	editWhichField: "Mau ganti yang mana: nama, mata uang, atau zona waktu?",
};

const en: OnboardingCopy = {
	consent:
		"Before we continue: Struku will store your personal data and transactions to track your finances. Do you agree?",
	consentRetry:
		"I need a clear yes/no before continuing. Do you agree to this data collection?",
	askDisplayName: "What should I call you?",
	askCurrency: `Should we use ${DEFAULT_CURRENCY} for your records? Or would you like a different one?`,
	askCurrencyRetry: "Please give a 3-letter currency code, e.g. IDR or USD.",
	askTimezone: `Is your timezone WIB (${DEFAULT_TIMEZONE})? Or something else?`,
	askTimezoneRetry: "Please tell me your timezone, e.g. WIB, WITA, or WIT.",
	summary: ({ displayName, currency, timezone }) =>
		`Let's double check:\nName: ${displayName}\nCurrency: ${currency}\nTimezone: ${timezone}\n\nLook good?`,
	summaryRetry: "Would you like to confirm or edit?",
	provisioned:
		'All set! Your account is ready. Try sending your first transaction, e.g. "coffee 25k".',
	editWhichField: "Which would you like to change: name, currency, or timezone?",
};

const bundles: Record<Locale, OnboardingCopy> = { id, en };

export function copyFor(locale: Locale): OnboardingCopy {
	return bundles[locale];
}
