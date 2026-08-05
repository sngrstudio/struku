import { Agent } from 'agents';
import type { NormalizedInboundMessage, OutboundAction } from './messaging/types';
import { advanceOnboarding, ONBOARDING_ENTRY_ACTION } from './onboarding/state-machine';
import { isValidCurrencyCode, provisionUser } from './onboarding/provisioning';
import {
	INITIAL_ONBOARDING_CONTEXT,
	type Locale,
	type OnboardingContext,
} from './onboarding/types';
import {
	committedReply,
	decideDraftCommand,
	decideEditValue,
	draftConfirmPrompt,
} from './draft/logic';
import { DRAFT_COPY } from './draft/copy';
import {
	deleteDraft,
	getEditState,
	mostRecentDraft,
	saveDraft,
	setEditState,
	updateDraftField,
} from './draft/store';
import type { PendingDraft } from './draft/types';
import { commitTransaction } from './ledger/writer';
import { sumExpensesOnDate } from './ledger/daily-total';
import { uuidv7 } from './lib/uuidv7';
import { detectAssetAccountSlug } from './ledger/payment-method';
import { buildParseReply, systemTroubleReply } from './parsing/reply';
import type { TextParser } from './parsing/types';
import { WorkersAiTextParser } from './parsing/workers-ai-text-parser';

const DRAFT_TIMEOUT_SECONDS = 30 * 60; // spec: propose 30 min, pinned here (configurable).

/**
 * Per-user coordination actor (ADR-0006), one instance per `user_id`
 * (`getAgentByName(env.Coordinator, userId)`). Built on the Cloudflare Agents
 * SDK — a Durable Object with SQLite storage — so pending-draft/confirmation
 * timeouts get first-class `this.schedule(...)` multiplexing over the single DO
 * alarm.
 *
 * It sits behind the MessagingProvider seam (ADR-0004): it consumes an
 * already-normalized inbound message and drives onboarding -> AI parse -> draft
 * -> confirm -> D1 commit. Decision logic (onboarding step transitions, draft
 * command/edit-value handling) lives in pure functions this class calls
 * (onboarding/state-machine.ts, draft/logic.ts) — this class owns I/O only:
 * this.sql reads/writes, D1 calls, and this.schedule.
 */
export class Coordinator extends Agent<Env> {
	// Overridable in tests (via runInDurableObject) to inject a fake TextParser
	// above env.AI — the deterministic-gating-test seam the spec calls for.
	// Defaults to the real Workers AI implementation in production.
	textParser: TextParser = new WorkersAiTextParser(this.env.AI);

	// this.sql is a bound tagged-template method; draft/store.ts's functions
	// take it as a plain parameter so they don't need an Agent instance.
	private sqlTag<T = Record<string, string | number | boolean | null>>(
		strings: TemplateStringsArray,
		...values: (string | number | boolean | null)[]
	): T[] {
		return this.sql<T>(strings, ...values);
	}

	// --- Onboarding context (ticket 11) --------------------------------------

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

	// --- Pending drafts (ticket 13) -------------------------------------------

	/** Scheduled callback (this.schedule) — EC-IMG-05 pattern applied to the
	 * text draft: an unanswered draft expires with no commit. */
	async expireDraft(payload: { entryId: string }): Promise<void> {
		deleteDraft(this.sqlTag.bind(this), payload.entryId);
	}

	private async removeDraft(draft: PendingDraft): Promise<void> {
		deleteDraft(this.sqlTag.bind(this), draft.entryId);
		if (draft.scheduleId) {
			await this.cancelSchedule(draft.scheduleId);
		}
	}

	private async startDraft(
		txnType: 'income' | 'expense',
		amount: number,
		currency: string,
		category: PendingDraft['category'],
		date: string,
		rawText: string,
		locale: Locale,
	): Promise<OutboundAction> {
		const entryId = uuidv7();
		const assetSlug = detectAssetAccountSlug(rawText);
		const schedule = await this.schedule(DRAFT_TIMEOUT_SECONDS, 'expireDraft', { entryId });

		const draft: PendingDraft = {
			entryId,
			txnType,
			amount,
			currency,
			category,
			date,
			assetSlug,
			rawText,
			createdAt: Date.now(),
			scheduleId: schedule.id,
		};
		saveDraft(this.sqlTag.bind(this), draft);

		return draftConfirmPrompt(draft, locale);
	}

	private async confirmDraft(draft: PendingDraft): Promise<boolean> {
		const result = await commitTransaction(this.env.DB, {
			entryId: draft.entryId,
			userId: this.name,
			txnType: draft.txnType,
			amountMajor: draft.amount,
			currency: draft.currency,
			category: draft.category,
			date: draft.date,
			assetSlug: draft.assetSlug,
			description: draft.rawText,
		});
		await this.removeDraft(draft);
		return result.ok;
	}

	/** A pending-draft reply — either a confirm/edit/discard command, or a
	 * value while an edit is in progress. Decision logic is pure (draft/logic.ts);
	 * this method only executes the I/O the decision calls for. Returns null
	 * when the message isn't a draft-control reply at all (EC-TXT-03 — falls
	 * through to starting a new draft). */
	private async handlePendingDraft(
		draft: PendingDraft,
		text: string,
		locale: Locale,
	): Promise<OutboundAction | null> {
		const sql = this.sqlTag.bind(this);

		const editState = getEditState(sql, draft.entryId);

		if (editState) {
			const decision = decideEditValue(draft, editState, text, locale);
			if (decision.kind === 'set_edit_field') {
				setEditState(sql, draft.entryId, decision.field);
			} else if (decision.kind === 'update_field') {
				updateDraftField(sql, draft.entryId, decision.field, decision.value);
				setEditState(sql, draft.entryId, null);
			}
			return decision.action;
		}

		const decision = decideDraftCommand(draft, text, locale);
		if (decision.kind === 'fall_through') return null;

		if (decision.kind === 'discard') {
			await this.removeDraft(draft);
			return decision.action;
		}
		if (decision.kind === 'start_edit') {
			setEditState(sql, draft.entryId, 'choosing');
			return decision.action;
		}
		// commit
		const committed = await this.confirmDraft(draft);
		if (!committed) {
			return { kind: 'text', text: DRAFT_COPY[locale].commitFailed };
		}
		// Ticket 23B: the day's expense total is read AFTER the write, so the
		// transaction just committed is included in it.
		const dailyTotal = await sumExpensesOnDate(
			this.env.DB,
			this.name,
			draft.date,
			draft.currency,
		);
		return committedReply(draft, dailyTotal, locale);
	}

	// --- Dispatch -------------------------------------------------------------

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
	 * AI parse -> pending draft -> confirm/edit/discard -> D1 commit. A
	 * pending-draft reply (typed synonym or tapped button, ADR-0004 §2) is
	 * checked BEFORE invoking TextParser, so "confirm" never gets sent to the
	 * model as if it were a new transaction.
	 */
	private async handleTransactionMessage(
		message: NormalizedInboundMessage,
	): Promise<OutboundAction> {
		if (message.kind !== 'text') {
			return { kind: 'text', text: `[${message.kind}]` };
		}

		const { locale, timezone } = await this.getUserProfile();

		const sql = this.sqlTag.bind(this);
		const pendingDraft = mostRecentDraft(sql);
		if (pendingDraft) {
			const response = await this.handlePendingDraft(pendingDraft, message.text, locale);
			if (response) return response;
			// EC-TXT-03: falls through to starting a NEW draft below.
		}

		const outcome = await this.textParser.parse(message.text, locale);

		// A call that never landed is not a message we failed to understand
		// (ADR-0005 §6). The catch itself lives at the TextParser boundary, so
		// this stays a branch on an outcome rather than a try/catch here — the
		// Coordinator never needs to know env.AI exists.
		if (outcome.kind === 'call_failed') {
			return systemTroubleReply(locale);
		}
		const result = outcome.result;

		if (
			result.intent === 'transaction' &&
			result.amount !== null &&
			result.txn_type !== null &&
			result.category !== null
		) {
			return this.startDraft(
				result.txn_type,
				result.amount,
				result.currency,
				result.category,
				result.date ?? this.todayIn(timezone),
				message.text,
				locale,
			);
		}

		return buildParseReply(result, locale, timezone);
	}

	private async getUserProfile(): Promise<{ locale: Locale; timezone: string }> {
		const profile = await this.env.DB.prepare(
			`SELECT locale, timezone FROM users WHERE id = ?`,
		)
			.bind(this.name)
			.first<{ locale: string; timezone: string }>();
		return {
			locale: profile?.locale.startsWith('en') ? 'en' : 'id',
			timezone: profile?.timezone ?? 'Asia/Jakarta',
		};
	}

	private todayIn(timezone: string): string {
		return new Intl.DateTimeFormat('en-CA', {
			timeZone: timezone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
		}).format(new Date());
	}
}
