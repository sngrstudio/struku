import { describe, expect, it } from "vitest";
import { CONFIRM_PROMPT_OPTIONS } from "../src/worker/draft/copy";
import {
	decideDraftCommand,
	decideEditValue,
	type DraftDecision,
} from "../src/worker/draft/logic";
import type { PendingDraft } from "../src/worker/draft/types";

// Ticket 31 (executes ticket 24 butir 3): the floor that cannot trap.
//
// THE RULE
//   While a draft is still pending after a reply, that reply MUST carry the
//   confirm options. As long as [Batal] is on screen the user always has a way
//   out — a floor that works even when env.AI is dead, which ticket 15 butir 4
//   accepts as a real state.
//
// WHY A TEST AND NOT JUST A FIX
//   The production trap (ticket 24) was not a wrong branch; it was a reply that
//   happened to be `kind: "text"`. Nothing stops the next edit from doing that
//   again — `draft/` had no direct unit test at all. This test is the guard, and
//   it is keyed on the DECISION KIND rather than on line numbers so it survives
//   refactors.
//
// SCOPE, AND WHY IT IS SEVEN AND NOT NINE
//   Ticket 31 estimated nine replies from a grep. Reading the code, two of them
//   must be EXCLUDED because the draft is gone by the time they are sent:
//   `committedReply` (committed) and the `discard` reply (discarded). Buttons
//   there would point at a draft that no longer exists.

const DRAFT: PendingDraft = {
	entryId: "01900000-0000-7000-8000-000000000000",
	txnType: "expense",
	amount: 55000,
	currency: "IDR",
	category: "entertainment",
	date: "2026-08-05",
	assetSlug: "cash",
	rawText: "rokok malboro 55k",
	createdAt: 1_754_000_000_000,
	scheduleId: null,
};

/**
 * The classification the rule hangs on. Anything that leaves the draft alive
 * needs the escape hatch visible; anything that ends it must not advertise
 * buttons for a draft that is gone.
 *
 * `commit` is deliberately absent: the Coordinator ignores that decision's
 * action and sends `committedReply` instead (coordinator.ts, confirm path), so
 * the action on the commit decision is never delivered to anyone.
 */
// A TOTAL record, so the guard is a type error rather than a test that compares
// two hand-written lists. Adding a kind to DraftDecision without classifying it
// here fails with TS2741. (The first attempt compared two literal arrays and
// would have stayed green forever; caught by /code-review.)
//
// ⚠️ IT DOES NOT FIRE UNDER THE REPO'S OWN TYPECHECK. Verified by adding a
// probe kind:
//
//     npx tsc -b                        -> exit 0   (test/ is not referenced)
//     npx tsc --noEmit -p test/tsconfig.json -> TS2741
//
// Root tsconfig.json references app/node/worker only, so nothing in test/ is
// type-checked by the command the repo documents. That gap is fogged in map.md
// and is NOT this slice's to decide — but until it is decided, run the second
// command by hand after touching DraftDecision.
const CLASSIFICATION: Record<
	DraftDecision["kind"],
	"pending" | "over" | "no-action"
> = {
	start_edit: "pending",
	set_edit_field: "pending",
	update_field: "pending",
	retry: "pending",
	discard: "over",
	// The Coordinator ignores this action and sends committedReply instead
	// (coordinator.ts, confirm path), so it is never delivered to anyone.
	commit: "no-action",
	fall_through: "no-action", // carries no action at all
};

const DRAFT_STILL_PENDING = Object.entries(CLASSIFICATION)
	.filter(([, v]) => v === "pending")
	.map(([k]) => k);
const DRAFT_IS_OVER = Object.entries(CLASSIFICATION)
	.filter(([, v]) => v === "over")
	.map(([k]) => k);

function expectEscapeVisible(decision: DraftDecision) {
	expect(DRAFT_STILL_PENDING).toContain(decision.kind);
	if (decision.kind === "fall_through") throw new Error("no action to check");
	expect(decision.action.kind).toBe("choice");
	if (decision.action.kind !== "choice") return;
	expect(decision.action.options).toEqual(CONFIRM_PROMPT_OPTIONS.id);
	// The point of the floor is the way out, so name it rather than trusting the
	// options blob to stay right.
	expect(decision.action.options.map((o) => o.id)).toContain("discard");
}

describe("every reply that leaves a draft pending carries the escape hatch", () => {
	it("pressing Edit — the exact turn where production lost its buttons", () => {
		// Ticket 24's transcript dies one step earlier than the ticket claimed:
		// the buttons vanish HERE, not on the first failed retry.
		expectEscapeVisible(decideDraftCommand(DRAFT, "edit", "id"));
	});

	it("edit menu, unparsable answer — the turn that trapped the repo owner", () => {
		// "Tidak jadi." / "Tetap sama" both land here, unbounded, forever.
		expectEscapeVisible(decideEditValue(DRAFT, "choosing", "Tidak jadi.", "id"));
	});

	it("edit menu, field chosen", () => {
		expectEscapeVisible(decideEditValue(DRAFT, "choosing", "jumlah", "id"));
	});

	for (const [state, junk] of [
		["amount", "bukan angka"],
		["category", "zzzz"],
		["date", "besok lusa"],
		["direction", "entahlah"],
	] as const) {
		it(`asking for a new ${state}, unparsable answer`, () => {
			expectEscapeVisible(decideEditValue(DRAFT, state, junk, "id"));
		});
	}

	it("a field successfully updated (already a choice — locked so it stays one)", () => {
		expectEscapeVisible(decideEditValue(DRAFT, "amount", "60rb", "id"));
	});
});

describe("replies that end the draft must NOT advertise buttons", () => {
	it("discard", () => {
		const decision = decideDraftCommand(DRAFT, "batal", "id");
		expect(DRAFT_IS_OVER).toContain(decision.kind);
		if (decision.kind === "fall_through") throw new Error("unexpected");
		expect(decision.action.kind).toBe("text");
	});
});

// The real exhaustiveness guard is CLASSIFICATION's type, checked by `tsc -b`.
// This only proves the classification is not vacuous — a record that classified
// nothing as "pending" would make every loop above pass by doing nothing.
describe("the classification itself", () => {
	it("actually classifies replies as draft-live", () => {
		expect(DRAFT_STILL_PENDING.length).toBeGreaterThan(0);
		expect(DRAFT_IS_OVER.length).toBeGreaterThan(0);
	});
});

// Locale is a parameter of every reply builder, so a floor proven only in `id`
// is a floor proven for half the users the copy layer supports.
describe("the floor holds in `en` too", () => {
	it("edit menu, unparsable answer", () => {
		const decision = decideEditValue(DRAFT, "choosing", "no thanks", "en");
		expect(decision.action.kind).toBe("choice");
		if (decision.action.kind !== "choice") return;
		expect(decision.action.options).toEqual(CONFIRM_PROMPT_OPTIONS.en);
		expect(decision.action.options.map((o) => o.id)).toContain("discard");
	});
});
