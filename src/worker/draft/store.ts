import type { EditState } from "./edit-state";
import type { PendingDraft } from "./types";

// Tagged-template SQL is bound to the Agent instance (this.sql), so this
// module takes it as a parameter rather than owning a connection — the
// Coordinator still runs every statement, but the schema/row-mapping/query
// shapes live here, mirroring how onboarding/provisioning.ts holds D1 SQL
// separately from coordinator.ts's dispatch logic.
type SqlTag = <T = Record<string, string | number | boolean | null>>(
	strings: TemplateStringsArray,
	...values: (string | number | boolean | null)[]
) => T[];

interface DraftRow {
	entry_id: string;
	txn_type: string;
	amount: number;
	currency: string;
	category: string;
	date: string;
	asset_slug: string;
	created_at: number;
	schedule_id: string | null;
	edit_field: string | null;
}

function rowToDraft(row: DraftRow): PendingDraft {
	return {
		entryId: row.entry_id,
		txnType: row.txn_type as PendingDraft["txnType"],
		amount: row.amount,
		currency: row.currency,
		category: row.category as PendingDraft["category"],
		date: row.date,
		assetSlug: row.asset_slug as PendingDraft["assetSlug"],
		createdAt: row.created_at,
		scheduleId: row.schedule_id,
	};
}

export function ensureDraftTable(sql: SqlTag): void {
	void sql`
		CREATE TABLE IF NOT EXISTS pending_drafts (
			entry_id TEXT PRIMARY KEY,
			txn_type TEXT NOT NULL,
			amount REAL NOT NULL,
			currency TEXT NOT NULL,
			category TEXT NOT NULL,
			date TEXT NOT NULL,
			asset_slug TEXT NOT NULL,
			created_at INTEGER NOT NULL,
			schedule_id TEXT,
			edit_field TEXT
		)
	`;
}

/** EC-TXT-03: a new transaction message while a draft is pending starts a new
 * draft rather than overwriting — so more than one row can exist at once. */
export function listPendingDrafts(sql: SqlTag): PendingDraft[] {
	ensureDraftTable(sql);
	const rows = sql<DraftRow>`SELECT * FROM pending_drafts ORDER BY created_at DESC`;
	return rows.map(rowToDraft);
}

/** The most-recently-created still-pending draft is what confirm/edit/discard
 * (typed or tapped) resolves to — buttons carry no draft id (ADR-0004 seam),
 * so disambiguation is LIFO. */
export function mostRecentDraft(sql: SqlTag): PendingDraft | null {
	return listPendingDrafts(sql)[0] ?? null;
}

export function getEditState(sql: SqlTag, entryId: string): EditState | null {
	ensureDraftTable(sql);
	const rows = sql<{
		edit_field: string | null;
	}>`SELECT edit_field FROM pending_drafts WHERE entry_id = ${entryId}`;
	return (rows[0]?.edit_field as EditState | null) ?? null;
}

export function setEditState(
	sql: SqlTag,
	entryId: string,
	state: EditState | null,
): void {
	ensureDraftTable(sql);
	void sql`UPDATE pending_drafts SET edit_field = ${state} WHERE entry_id = ${entryId}`;
}

export function saveDraft(sql: SqlTag, draft: PendingDraft): void {
	ensureDraftTable(sql);
	void sql`
		INSERT INTO pending_drafts
			(entry_id, txn_type, amount, currency, category, date, asset_slug, created_at, schedule_id, edit_field)
		VALUES (${draft.entryId}, ${draft.txnType}, ${draft.amount}, ${draft.currency}, ${draft.category}, ${draft.date}, ${draft.assetSlug}, ${draft.createdAt}, ${draft.scheduleId}, NULL)
	`;
}

export function updateDraftField(
	sql: SqlTag,
	entryId: string,
	field: "amount" | "category" | "date" | "txn_type",
	value: string | number,
): void {
	ensureDraftTable(sql);
	if (field === "amount") {
		void sql`UPDATE pending_drafts SET amount = ${value as number} WHERE entry_id = ${entryId}`;
	} else if (field === "category") {
		void sql`UPDATE pending_drafts SET category = ${value as string} WHERE entry_id = ${entryId}`;
	} else if (field === "date") {
		void sql`UPDATE pending_drafts SET date = ${value as string} WHERE entry_id = ${entryId}`;
	} else {
		void sql`UPDATE pending_drafts SET txn_type = ${value as string} WHERE entry_id = ${entryId}`;
	}
}

export function deleteDraft(sql: SqlTag, entryId: string): void {
	ensureDraftTable(sql);
	void sql`DELETE FROM pending_drafts WHERE entry_id = ${entryId}`;
}
