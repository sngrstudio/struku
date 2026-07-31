import { uuidv7 } from "./lib/uuidv7";
import type { Channel } from "./messaging/types";

// Router-owned identity resolution (ADR-0004 §4): looks up channel_identities
// by (channel, external_id), eagerly minting a users + channel_identities row
// on first contact (ADR-0003 §1). The provider never sees a user_id.
export async function resolveUserId(
	db: D1Database,
	channel: Channel,
	externalId: string,
): Promise<string> {
	const existing = await db
		.prepare(
			`SELECT user_id FROM channel_identities WHERE channel = ? AND external_id = ?`,
		)
		.bind(channel, externalId)
		.first<{ user_id: string }>();

	if (existing) {
		return existing.user_id;
	}

	const userId = uuidv7();
	const identityId = uuidv7();
	const now = Date.now();

	try {
		await db.batch([
			db
				.prepare(`INSERT INTO users (id, created_at) VALUES (?, ?)`)
				.bind(userId, now),
			db
				.prepare(
					`INSERT INTO channel_identities (id, user_id, channel, external_id, created_at)
					 VALUES (?, ?, ?, ?, ?)`,
				)
				.bind(identityId, userId, channel, externalId, now),
		]);
	} catch {
		// UNIQUE (channel, external_id) lost a mint race to a concurrent first
		// contact from the same chat — the row now exists; resolve to it.
		const raced = await db
			.prepare(
				`SELECT user_id FROM channel_identities WHERE channel = ? AND external_id = ?`,
			)
			.bind(channel, externalId)
			.first<{ user_id: string }>();
		if (!raced) throw new Error("identity mint failed and no row to recover");
		return raced.user_id;
	}

	return userId;
}
