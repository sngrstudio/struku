import { isAffirmative } from "../onboarding/parsing";

export type DraftCommand = "confirm" | "edit" | "discard";

const DISCARD_SYNONYMS = new Set(["discard", "batal", "hapus", "cancel"]);
const EDIT_SYNONYMS = new Set(["edit", "ubah", "ganti"]);

// ADR-0004 §2/EC-CH-03: a callback_query tap normalizes to the exact button
// id ('confirm'/'edit'/'discard'); a typed synonym must behave identically.
export function parseDraftCommand(text: string): DraftCommand | null {
	const normalized = text.trim().toLowerCase();
	if (normalized === "confirm" || isAffirmative(normalized)) return "confirm";
	if (normalized === "discard" || DISCARD_SYNONYMS.has(normalized)) return "discard";
	if (normalized === "edit" || EDIT_SYNONYMS.has(normalized)) return "edit";
	return null;
}
