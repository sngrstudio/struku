// Tracer #1 keeps edit minimal (ticket 13): after 'edit', the bot asks which
// field, then which field's new value is being awaited. This is separate
// per-draft state (not the draft's own fields) so a draft can sit in
// "awaiting an edit value" without its data being half-written.
// 'choosing' = the bot asked "which field?" and is waiting for the field
// name itself; a concrete field = the bot is now waiting for that field's
// new value.
export type EditField = "amount" | "category" | "date" | "direction";
export type EditState = "choosing" | EditField;

export function parseEditField(text: string): EditField | null {
	const normalized = text.trim().toLowerCase();
	if (["jumlah", "amount"].includes(normalized)) return "amount";
	if (["kategori", "category"].includes(normalized)) return "category";
	if (["tanggal", "date"].includes(normalized)) return "date";
	if (["jenis", "direction", "arah"].includes(normalized)) return "direction";
	return null;
}
