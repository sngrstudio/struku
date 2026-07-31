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
	createdAt: number; // unix millis
	scheduleId: string | null; // this.schedule()'s id, for cancelSchedule on confirm/discard
}
