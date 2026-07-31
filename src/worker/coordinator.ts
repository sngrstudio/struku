import { Agent } from 'agents';
import type { NormalizedInboundMessage, OutboundAction } from './messaging/types';
import { advanceOnboarding, ONBOARDING_ENTRY_ACTION } from './onboarding/state-machine';
import { isValidCurrencyCode, provisionUser } from './onboarding/provisioning';
import {
	INITIAL_ONBOARDING_CONTEXT,
	type Locale,
	type OnboardingContext,
} from './onboarding/types';
import { buildParseReply } from './parsing/reply';
import type { TextParser } from './parsing/types';
import { WorkersAiTextParser } from './parsing/workers-ai-text-parser';

/**
 * Per-user coordination actor (ADR-0006), one instance per `user_id`
 * (`getAgentByName(env.Coordinator, userId)`). Built on the Cloudflare Agents
 * SDK — a Durable Object with SQLite storage — so pending-draft/confirmation
 * timeouts get first-class `this.schedule(...)` multiplexing over the single DO
 * alarm.
 *
 * It sits behind the MessagingProvider seam (ADR-0004): it consumes an
 * already-normalized inbound message and drives onboarding -> AI parse -> draft
 * -> confirm -> D1 commit. AI parse / draft / confirm land in slices 12-13.
 */
export class Coordinator extends Agent<Env> {
	// Overridable in tests (via runInDurableObject) to inject a fake TextParser
	// above env.AI — the deterministic-gating-test seam the spec calls for.
	// Defaults to the real Workers AI implementation in production.
	textParser: TextParser = new WorkersAiTextParser(this.env.AI);

	private ensureOnboardingTable(): void {
		void this.sql`
			CREATE TABLE IF NOT EXISTS onboarding_context (
				id INTEGER PRIMARY KEY CHECK (id = 0),
				context TEXT NOT NULL
			)
		`;
	}

	// Conversation context lives in this.sql (ADR-0006), never duplicated into
	// D1 — the single row is keyed by a CHECK-enforced id=0 (one Agent instance
	// per user, so there is never more than one onboarding in flight here). A
	// missing row IS the "first-ever contact" signal — nothing to advance on
	// yet, so the caller sends the language-neutral entry prompt instead.
	private loadOnboardingContext(): OnboardingContext | null {
		this.ensureOnboardingTable();
		const rows = this.sql<{
			context: string;
		}>`SELECT context FROM onboarding_context WHERE id = 0`;
		if (rows.length === 0) return null;
		return JSON.parse(rows[0].context) as OnboardingContext;
	}

	private saveOnboardingContext(context: OnboardingContext): void {
		this.ensureOnboardingTable();
		const json = JSON.stringify(context);
		void this.sql`
			INSERT INTO onboarding_context (id, context) VALUES (0, ${json})
			ON CONFLICT (id) DO UPDATE SET context = excluded.context
		`;
	}

	/**
	 * Called directly as Durable Object RPC by the webhook router (same
	 * codebase, so no @callable()/WebSocket hop — see the Agents SDK "Worker
	 * calling agent" pattern). `onboardingCompleted` is the router's D1 read of
	 * `users.onboarding_completed_at IS NOT NULL` (ADR-0003 §6) — the actor
	 * never queries that column itself, keeping the guard at one checkpoint.
	 */
	async handleInboundMessage(
		message: NormalizedInboundMessage,
		onboardingCompleted: boolean,
	): Promise<OutboundAction> {
		if (!onboardingCompleted) {
			return this.handleOnboardingMessage(message);
		}

		return this.handleTransactionMessage(message);
	}

	/**
	 * Ticket 12: AI parse -> plain-language reply. No pending draft, no
	 * confirm/edit/discard, no D1 write — that's ticket 13, built on top of
	 * this same ParseResult. Non-text messages (image/document) aren't parsed
	 * by TextParser (ADR-0005 is text-only); they still echo per ticket 10's
	 * stand-in until the image pipeline exists (spec Out of Scope).
	 */
	private async handleTransactionMessage(
		message: NormalizedInboundMessage,
	): Promise<OutboundAction> {
		if (message.kind !== 'text') {
			return { kind: 'text', text: `[${message.kind}]` };
		}

		const profile = await this.env.DB.prepare(
			`SELECT locale, timezone FROM users WHERE id = ?`,
		)
			.bind(this.name)
			.first<{ locale: string; timezone: string }>();
		const locale: Locale = profile?.locale.startsWith('en') ? 'en' : 'id';
		const timezone = profile?.timezone ?? 'Asia/Jakarta';

		const result = await this.textParser.parse(message.text, locale);
		return buildParseReply(result, locale, timezone);
	}

	private async handleOnboardingMessage(
		message: NormalizedInboundMessage,
	): Promise<OutboundAction> {
		const storedContext = this.loadOnboardingContext();

		// First-ever contact: nothing to advance on yet, just send the
		// language-neutral entry prompt (ADR-0003 §2 — language is asked first).
		if (storedContext === null) {
			this.saveOnboardingContext(INITIAL_ONBOARDING_CONTEXT);
			return ONBOARDING_ENTRY_ACTION;
		}

		const inboundText = message.kind === 'text' ? message.text : '';
		const result = await advanceOnboarding(storedContext, inboundText, (code) =>
			isValidCurrencyCode(this.env.DB, code),
		);

		this.saveOnboardingContext(result.context);

		if (result.readyToProvision) {
			await provisionUser(this.env.DB, this.name, result.context.answers);
		}

		return result.action;
	}
}
