import type { Locale } from "../onboarding/types";
import type { OutboundAction } from "../messaging/types";
import { formatAmount } from "../parsing/format-amount";
import { transactionSummaryLine } from "../parsing/reply";
import { parseDraftCommand, type DraftCommand } from "./command";
import { CONFIRM_PROMPT_OPTIONS, DRAFT_COPY } from "./copy";
import { parseEditField, type EditState } from "./edit-state";
import {
	parseEditAmount,
	parseEditCategory,
	parseEditDate,
	parseEditDirection,
} from "./parse-edit-value";
import type { PendingDraft } from "./types";

/** What the Coordinator should do in response to a message while a draft is
 * pending — a plain data description the caller executes (SQL/D1/schedule),
 * mirroring the onboarding state machine's pure context->action shape. */
export type DraftDecision =
	| { kind: "discard"; action: OutboundAction }
	| { kind: "commit"; action: OutboundAction }
	| { kind: "start_edit"; action: OutboundAction }
	| {
			kind: "set_edit_field";
			field: "amount" | "category" | "date" | "direction";
			action: OutboundAction;
	  }
	| {
			kind: "update_field";
			field: "amount" | "category" | "date" | "txn_type";
			value: string | number;
			action: OutboundAction;
	  }
	| { kind: "retry"; action: OutboundAction }
	| { kind: "fall_through" }; // not a draft-control reply — start a new draft instead

function draftConfirmPrompt(draft: PendingDraft, locale: Locale): OutboundAction {
	const summary = transactionSummaryLine(
		draft.txnType,
		draft.amount,
		draft.currency,
		draft.category,
		draft.date,
		locale,
	);
	return {
		kind: "choice",
		text: `${summary} ${DRAFT_COPY[locale].confirmQuestion}`,
		options: CONFIRM_PROMPT_OPTIONS[locale],
	};
}

/**
 * Ticket 23B: the reply after a successful commit. The transaction line is a
 * deliberate echo of what the user just confirmed — a closing marker, not new
 * information. The one genuinely new thing is the day's expense total, which
 * the caller supplies (it is a D1 read; this stays pure).
 */
export function committedReply(
	draft: PendingDraft,
	dailyTotalMajor: number,
	locale: Locale,
): OutboundAction {
	const copy = DRAFT_COPY[locale];
	const summary = transactionSummaryLine(
		draft.txnType,
		draft.amount,
		draft.currency,
		draft.category,
		draft.date,
		locale,
	);
	const total = copy.dailyExpenseTotal(formatAmount(dailyTotalMajor, draft.currency));
	return { kind: "text", text: `${copy.committed}\n${summary}\n${total}` };
}

const EDIT_FIELD_PROMPTS = {
	amount: (locale: Locale) => DRAFT_COPY[locale].askNewAmount,
	category: (locale: Locale) => DRAFT_COPY[locale].askNewCategory,
	date: (locale: Locale) => DRAFT_COPY[locale].askNewDate,
	direction: (locale: Locale) => DRAFT_COPY[locale].askNewDirection,
} as const;

/**
 * Pure decision for a message while a draft is pending and no edit is in
 * progress: is this confirm/edit/discard (typed synonym or tapped button,
 * ADR-0004 §2), or does it fall through to starting a new draft (EC-TXT-03)?
 */
export function decideDraftCommand(
	draft: PendingDraft,
	text: string,
	locale: Locale,
): DraftDecision {
	const command: DraftCommand | null = parseDraftCommand(text);
	if (!command) return { kind: "fall_through" };

	if (command === "discard") {
		return { kind: "discard", action: { kind: "text", text: DRAFT_COPY[locale].discarded } };
	}
	if (command === "edit") {
		return {
			kind: "start_edit",
			action: { kind: "text", text: DRAFT_COPY[locale].editWhichField },
		};
	}
	// confirm — the actual ledger write is I/O the caller performs; this only
	// signals intent, since success/failure copy depends on the write result.
	return { kind: "commit", action: draftConfirmPrompt(draft, locale) };
}

/**
 * Pure decision for a message while an edit is in progress: either "which
 * field" (editState === 'choosing') or a new value for a concrete field.
 * Tracer #1 keeps edit minimal: direct value replacement on the pending
 * draft, then re-summarize (no re-parse through TextParser).
 */
export function decideEditValue(
	draft: PendingDraft,
	editState: EditState,
	text: string,
	locale: Locale,
): Exclude<DraftDecision, { kind: "fall_through" }> {
	const copy = DRAFT_COPY[locale];

	if (editState === "choosing") {
		const field = parseEditField(text);
		if (!field) return { kind: "retry", action: { kind: "text", text: copy.editFieldRetry } };
		return {
			kind: "set_edit_field",
			field,
			action: { kind: "text", text: EDIT_FIELD_PROMPTS[field](locale) },
		};
	}

	if (editState === "amount") {
		const amount = parseEditAmount(text);
		if (amount === null) return { kind: "retry", action: { kind: "text", text: copy.askNewAmount } };
		return { kind: "update_field", field: "amount", value: amount, action: draftConfirmPrompt({ ...draft, amount }, locale) };
	}
	if (editState === "category") {
		const category = parseEditCategory(text);
		if (!category) return { kind: "retry", action: { kind: "text", text: copy.askNewCategory } };
		return { kind: "update_field", field: "category", value: category, action: draftConfirmPrompt({ ...draft, category }, locale) };
	}
	if (editState === "date") {
		const date = parseEditDate(text);
		if (!date) return { kind: "retry", action: { kind: "text", text: copy.askNewDate } };
		return { kind: "update_field", field: "date", value: date, action: draftConfirmPrompt({ ...draft, date }, locale) };
	}
	// direction
	const direction = parseEditDirection(text);
	if (!direction) return { kind: "retry", action: { kind: "text", text: copy.askNewDirection } };
	return {
		kind: "update_field",
		field: "txn_type",
		value: direction,
		action: draftConfirmPrompt({ ...draft, txnType: direction }, locale),
	};
}

export { draftConfirmPrompt };
