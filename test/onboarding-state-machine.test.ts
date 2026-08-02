import { describe, expect, it } from "vitest";
import { advanceOnboarding } from "../src/worker/onboarding/state-machine";
import { INITIAL_ONBOARDING_CONTEXT } from "../src/worker/onboarding/types";

// Ticket 11: pure step-transition logic (ADR-0003 §2 order), tested without a
// DO — the Coordinator wires this against this.sql + D1 currency lookups.

const alwaysValidCurrency = async () => true;

describe("onboarding state machine", () => {
	it("starts at 'language' and re-prompts on an unrecognized language reply", async () => {
		const result = await advanceOnboarding(
			INITIAL_ONBOARDING_CONTEXT,
			"blah",
			alwaysValidCurrency,
		);

		expect(result.context.step).toBe("language");
		expect(result.action).toEqual({
			kind: "choice",
			text: expect.stringContaining("bahasa"),
			options: [
				{ id: "id", label: "🇮🇩 Indonesia" },
				{ id: "en", label: "🇬🇧 English" },
			],
		});
		expect(result.readyToProvision).toBe(false);
	});

	it("walks the full happy-path transcript: language -> consent -> name -> currency -> timezone -> summary -> confirm", async () => {
		let context = INITIAL_ONBOARDING_CONTEXT;

		let step = await advanceOnboarding(context, "id", alwaysValidCurrency);
		expect(step.context.step).toBe("consent");
		expect(step.context.answers.locale).toBe("id");
		context = step.context;

		step = await advanceOnboarding(context, "consent_yes", alwaysValidCurrency);
		expect(step.context.step).toBe("display_name");
		expect(step.context.answers.consentGivenAt).toEqual(expect.any(Number));
		context = step.context;

		step = await advanceOnboarding(context, "Budi", alwaysValidCurrency);
		expect(step.context.step).toBe("currency");
		expect(step.context.answers.displayName).toBe("Budi");
		context = step.context;

		step = await advanceOnboarding(context, "accept_default", alwaysValidCurrency);
		expect(step.context.step).toBe("timezone");
		expect(step.context.answers.currency).toBe("IDR");
		context = step.context;

		step = await advanceOnboarding(context, "accept_default", alwaysValidCurrency);
		expect(step.context.step).toBe("summary");
		expect(step.context.answers.timezone).toBe("Asia/Jakarta");
		expect(step.action.kind).toBe("choice");
		context = step.context;

		step = await advanceOnboarding(context, "confirm", alwaysValidCurrency);
		expect(step.context.step).toBe("provisioning");
		expect(step.readyToProvision).toBe(true);
		expect(step.context.answers).toEqual({
			locale: "id",
			consentGivenAt: expect.any(Number),
			displayName: "Budi",
			currency: "IDR",
			timezone: "Asia/Jakarta",
		});
	});

	it("does not advance past consent on an ambiguous/unrelated reply (NFR-SEC-08)", async () => {
		const consentContext = (
			await advanceOnboarding(
				INITIAL_ONBOARDING_CONTEXT,
				"id",
				alwaysValidCurrency,
			)
		).context;

		const result = await advanceOnboarding(
			consentContext,
			"apaan sih ini",
			alwaysValidCurrency,
		);

		expect(result.context.step).toBe("consent");
		expect(result.context.answers.consentGivenAt).toBeNull();
	});

	it("rejects an invalid currency code and re-prompts without advancing", async () => {
		let context = (
			await advanceOnboarding(
				INITIAL_ONBOARDING_CONTEXT,
				"id",
				alwaysValidCurrency,
			)
		).context;
		context = (
			await advanceOnboarding(context, "consent_yes", alwaysValidCurrency)
		).context;
		context = (await advanceOnboarding(context, "Budi", alwaysValidCurrency))
			.context;

		const neverValid = async () => false;
		const result = await advanceOnboarding(context, "XYZ", neverValid);

		expect(result.context.step).toBe("currency");
		expect(result.context.answers.currency).toBeNull();
	});

	it("accepts an overridden currency code when valid", async () => {
		let context = (
			await advanceOnboarding(
				INITIAL_ONBOARDING_CONTEXT,
				"en",
				alwaysValidCurrency,
			)
		).context;
		context = (
			await advanceOnboarding(context, "consent_yes", alwaysValidCurrency)
		).context;
		context = (await advanceOnboarding(context, "Alex", alwaysValidCurrency))
			.context;

		const result = await advanceOnboarding(context, "USD", alwaysValidCurrency);

		expect(result.context.step).toBe("timezone");
		expect(result.context.answers.currency).toBe("USD");
	});

	it("returns to the display_name step when Edit -> 'name' is chosen at the summary", async () => {
		let context = (
			await advanceOnboarding(
				INITIAL_ONBOARDING_CONTEXT,
				"id",
				alwaysValidCurrency,
			)
		).context;
		context = (
			await advanceOnboarding(context, "consent_yes", alwaysValidCurrency)
		).context;
		context = (await advanceOnboarding(context, "Budi", alwaysValidCurrency))
			.context;
		context = (
			await advanceOnboarding(context, "accept_default", alwaysValidCurrency)
		).context;
		context = (
			await advanceOnboarding(context, "accept_default", alwaysValidCurrency)
		).context;
		expect(context.step).toBe("summary");

		const editResult = await advanceOnboarding(
			context,
			"edit",
			alwaysValidCurrency,
		);
		expect(editResult.context.step).toBe("summary");

		const nameResult = await advanceOnboarding(
			context,
			"nama",
			alwaysValidCurrency,
		);
		expect(nameResult.context.step).toBe("display_name");
		// Prior answers survive the edit round-trip.
		expect(nameResult.context.answers.currency).toBe("IDR");
	});
});
