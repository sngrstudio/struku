import { Agent } from 'agents';
import type { NormalizedInboundMessage } from './messaging/types';

/**
 * Per-user coordination actor (ADR-0006), one instance per `user_id`
 * (`getAgentByName(env.Coordinator, userId)`). Built on the Cloudflare Agents
 * SDK — a Durable Object with SQLite storage — so pending-draft/confirmation
 * timeouts get first-class `this.schedule(...)` multiplexing over the single DO
 * alarm.
 *
 * It sits behind the MessagingProvider seam (ADR-0004): it consumes an
 * already-normalized inbound message and drives onboarding -> AI parse -> draft
 * -> confirm -> D1 commit. That behaviour lands in slices 11-13; ticket 10
 * only wires an echo stand-in so the webhook round-trip (router -> gate ->
 * provider -> actor -> outbound reply) proves out end to end first.
 */
export class Coordinator extends Agent<Env> {
  // Onboarding state machine, pending draft, and confirm/commit flow are built
  // in slices 11-13 on top of this.sql + this.schedule.

  /**
   * Ticket 10 echo stand-in: replies with the inbound text verbatim. Called
   * directly as Durable Object RPC by the webhook router (same codebase, so
   * no @callable()/WebSocket hop — see the Agents SDK "Worker calling agent"
   * pattern). Replaced by onboarding SM / draft / confirm in slices 11-13.
   */
  async handleInboundMessage(
    message: NormalizedInboundMessage,
  ): Promise<string> {
    return message.kind === 'text' ? message.text : `[${message.kind}]`;
  }
}
