import { copyFor, DEFAULT_CURRENCY, DEFAULT_TIMEZONE } from "./copy";
import type { OutboundAction } from "../messaging/types";
import {
	isAffirmative,
	parseCurrencyCode,
	parseLanguageChoice,
	parseTimezone,
} from "./parsing";
import type { Locale, OnboardingAnswers, OnboardingContext } from "./types";

export interface OnboardingStepResult {
	context: OnboardingContext;
	action: OutboundAction;
	/** Set only on the transition into 'provisioning' — the caller commits D1. */
	readyToProvision: boolean;
}

const LANGUAGE_PROMPT: OutboundAction = {
	kind: "choice",
	text: "Pilih bahasa / choose your language",
	options: [
		{ id: "id", label: "🇮🇩 Indonesia" },
		{ id: "en", label: "🇬🇧 English" },
	],
};

function consentPrompt(locale: Locale): OutboundAction {
	return {
		kind: "choice",
		text: copyFor(locale).consent,
		options: [{ id: "consent_yes", label: locale === "id" ? "Setuju" : "I agree" }],
	};
}

// ADR-0003 §4: fields with a spec default (currency -> IDR, timezone -> WIB)
// are offered as "here's the default, accept or override" rather than a bare
// open question.
function defaultOfferPrompt(
	locale: Locale,
	text: string,
	defaultLabel: string,
): OutboundAction {
	return {
		kind: "choice",
		text,
		options: [
			{ id: "accept_default", label: defaultLabel },
			{ id: "other", label: locale === "id" ? "Lainnya" : "Other" },
		],
	};
}

function currencyPrompt(locale: Locale): OutboundAction {
	return defaultOfferPrompt(locale, copyFor(locale).askCurrency, DEFAULT_CURRENCY);
}

function timezonePrompt(locale: Locale): OutboundAction {
	return defaultOfferPrompt(locale, copyFor(locale).askTimezone, "WIB");
}

function summaryPrompt(answers: OnboardingAnswers): OutboundAction {
	const locale = answers.locale ?? "id";
	return {
		kind: "choice",
		text: copyFor(locale).summary({
			displayName: answers.displayName ?? "",
			currency: answers.currency ?? "",
			timezone: answers.timezone ?? "",
		}),
		options: [
			{ id: "confirm", label: locale === "id" ? "Konfirmasi" : "Confirm" },
			{ id: "edit", label: locale === "id" ? "Edit" : "Edit" },
		],
	};
}

export const ONBOARDING_ENTRY_ACTION: OutboundAction = LANGUAGE_PROMPT;

/**
 * Pure(ish) onboarding transition: given the stored context and the inbound
 * normalized text, returns the next context + what to send back. `isValid
 * Currency` is the one injected effect (a D1 lookup against `currencies`),
 * everything else is a plain function of its inputs — the step order fixed by
 * ADR-0003 §2 (language -> consent -> display name -> currency -> timezone ->
 * confirm/edit summary -> provisioning).
 */
export async function advanceOnboarding(
	context: OnboardingContext,
	inboundText: string,
	isValidCurrency: (code: string) => Promise<boolean>,
): Promise<OnboardingStepResult> {
	const { step, answers } = context;
	const locale = answers.locale ?? "id";

	switch (step) {
		case "language": {
			const chosen = parseLanguageChoice(inboundText);
			if (!chosen) {
				return {
					context,
					action: LANGUAGE_PROMPT,
					readyToProvision: false,
				};
			}
			return {
				context: {
					step: "consent",
					answers: { ...answers, locale: chosen },
				},
				action: consentPrompt(chosen),
				readyToProvision: false,
			};
		}

		case "consent": {
			// NFR-SEC-08: only an explicit affirmative action advances; anything
			// else re-prompts the same notice rather than treating silence/an
			// unrelated reply as consent.
			if (inboundText.trim().toLowerCase() !== "consent_yes" && !isAffirmative(inboundText)) {
				return { context, action: consentPrompt(locale), readyToProvision: false };
			}
			return {
				context: {
					step: "display_name",
					answers: { ...answers, consentGivenAt: Date.now() },
				},
				action: { kind: "text", text: copyFor(locale).askDisplayName },
				readyToProvision: false,
			};
		}

		case "display_name": {
			const displayName = inboundText.trim();
			if (!displayName) {
				return {
					context,
					action: { kind: "text", text: copyFor(locale).askDisplayName },
					readyToProvision: false,
				};
			}
			return {
				context: { step: "currency", answers: { ...answers, displayName } },
				action: currencyPrompt(locale),
				readyToProvision: false,
			};
		}

		case "currency": {
			const normalized = inboundText.trim().toLowerCase();
			if (normalized === "accept_default") {
				return {
					context: {
						step: "timezone",
						answers: { ...answers, currency: DEFAULT_CURRENCY },
					},
					action: timezonePrompt(locale),
					readyToProvision: false,
				};
			}
			if (normalized === "other") {
				return {
					context,
					action: { kind: "text", text: copyFor(locale).askCurrencyRetry },
					readyToProvision: false,
				};
			}
			const code = parseCurrencyCode(inboundText);
			if (!code || !(await isValidCurrency(code))) {
				return {
					context,
					action: { kind: "text", text: copyFor(locale).askCurrencyRetry },
					readyToProvision: false,
				};
			}
			return {
				context: { step: "timezone", answers: { ...answers, currency: code } },
				action: timezonePrompt(locale),
				readyToProvision: false,
			};
		}

		case "timezone": {
			const normalized = inboundText.trim().toLowerCase();
			if (normalized === "accept_default") {
				return {
					context: {
						step: "summary",
						answers: { ...answers, timezone: DEFAULT_TIMEZONE },
					},
					action: summaryPrompt({ ...answers, timezone: DEFAULT_TIMEZONE }),
					readyToProvision: false,
				};
			}
			if (normalized === "other") {
				return {
					context,
					action: { kind: "text", text: copyFor(locale).askTimezoneRetry },
					readyToProvision: false,
				};
			}
			const timezone = parseTimezone(inboundText);
			if (!timezone) {
				return {
					context,
					action: { kind: "text", text: copyFor(locale).askTimezoneRetry },
					readyToProvision: false,
				};
			}
			const nextAnswers = { ...answers, timezone };
			return {
				context: { step: "summary", answers: nextAnswers },
				action: summaryPrompt(nextAnswers),
				readyToProvision: false,
			};
		}

		case "summary": {
			const normalized = inboundText.trim().toLowerCase();
			if (normalized === "confirm") {
				return {
					context: { step: "provisioning", answers },
					action: { kind: "text", text: copyFor(locale).provisioned },
					readyToProvision: true,
				};
			}
			if (normalized === "edit") {
				return {
					context,
					action: { kind: "text", text: copyFor(locale).editWhichField },
					readyToProvision: false,
				};
			}
			// Tracer #1 keeps edit minimal: naming which field re-opens that step.
			if (normalized === "nama" || normalized === "name") {
				return {
					context: { step: "display_name", answers },
					action: { kind: "text", text: copyFor(locale).askDisplayName },
					readyToProvision: false,
				};
			}
			if (normalized === "mata uang" || normalized === "currency") {
				return {
					context: { step: "currency", answers },
					action: currencyPrompt(locale),
					readyToProvision: false,
				};
			}
			if (normalized === "zona waktu" || normalized === "timezone") {
				return {
					context: { step: "timezone", answers },
					action: timezonePrompt(locale),
					readyToProvision: false,
				};
			}
			return {
				context,
				action: { kind: "text", text: copyFor(locale).summaryRetry },
				readyToProvision: false,
			};
		}

		case "provisioning": {
			// Provisioning already ran on the summary->confirm transition (the
			// only edge that returns readyToProvision: true). If the actor is
			// ever re-entered while still parked here — e.g. a redelivered
			// webhook racing the router's onboarding_completed_at read — this
			// must NOT re-provision (would duplicate the chart of accounts).
			return {
				context,
				action: { kind: "text", text: copyFor(locale).provisioned },
				readyToProvision: false,
			};
		}
	}
}
