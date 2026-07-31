// Onboarding conversation context (ADR-0003 §2/§6): the granular step + answers
// collected so far. Lives in the per-user Agent's this.sql, never duplicated
// into D1 — the only D1-visible signal is users.onboarding_completed_at.

export type OnboardingStep =
	| "language"
	| "consent"
	| "display_name"
	| "currency"
	| "timezone"
	| "summary"
	| "provisioning";

export type Locale = "id" | "en";

export interface OnboardingAnswers {
	locale: Locale | null;
	consentGivenAt: number | null;
	displayName: string | null;
	currency: string | null; // ISO 4217
	timezone: string | null; // IANA zone name
}

export const INITIAL_ONBOARDING_ANSWERS: OnboardingAnswers = {
	locale: null,
	consentGivenAt: null,
	displayName: null,
	currency: null,
	timezone: null,
};

export interface OnboardingContext {
	step: OnboardingStep;
	answers: OnboardingAnswers;
}

export const INITIAL_ONBOARDING_CONTEXT: OnboardingContext = {
	step: "language",
	answers: INITIAL_ONBOARDING_ANSWERS,
};
