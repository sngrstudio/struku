import type { CategorySlug } from "../parsing/types";

// A pending, uncommitted transaction draft (ADR-0002 §7: the entry has its
// DO-minted UUIDv7 id before the D1 write). Lives in the per-user Agent's
// this.sql (ADR-0006), never in D1 until confirm commits it.
export interface PendingDraft {
	entryId: string;
	txnType: "income" | "expense";
	amount: number; // major units
	currency: string;
	category: CategorySlug;
	date: string; // 'YYYY-MM-DD'
	assetSlug: "cash" | "bank" | "ewallet";
	// Ticket 22: the user's raw text, verbatim ("warteg 25rb"), carried here so
	// confirmDraft can write it to journal_entries.description. It is a display
	// label that defaults to raw text — not an archive: editing overwrites it.
	// null only for drafts created before 22, which never stored the text.
	rawText: string | null;
	createdAt: number; // unix millis
	scheduleId: string | null; // this.schedule()'s id, for cancelSchedule on confirm/discard
}
