// Minimal UUIDv7 (RFC 9562) generator: 48-bit unix-ms timestamp prefix (time-
// sortable, per ADR-0002 §7) + 74 random bits, using the Workers runtime's
// Web Crypto `getRandomValues` (no `crypto.randomUUID()`, which is v4-only).
export function uuidv7(): string {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);

	const ms = Date.now();
	bytes[0] = (ms / 2 ** 40) & 0xff;
	bytes[1] = (ms / 2 ** 32) & 0xff;
	bytes[2] = (ms / 2 ** 24) & 0xff;
	bytes[3] = (ms / 2 ** 16) & 0xff;
	bytes[4] = (ms / 2 ** 8) & 0xff;
	bytes[5] = ms & 0xff;

	bytes[6] = 0x70 | (bytes[6] & 0x0f); // version 7
	bytes[8] = 0x80 | (bytes[8] & 0x3f); // variant 10

	const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
		"",
	);
	return [
		hex.slice(0, 8),
		hex.slice(8, 12),
		hex.slice(12, 16),
		hex.slice(16, 20),
		hex.slice(20, 32),
	].join("-");
}
