import { Agent } from 'agents';

/**
 * Per-user coordination actor (ADR-0006), one instance per `user_id`
 * (`getAgentByName(env.Coordinator, userId)`). Built on the Cloudflare Agents
 * SDK — a Durable Object with SQLite storage — so pending-draft/confirmation
 * timeouts get first-class `this.schedule(...)` multiplexing over the single DO
 * alarm.
 *
 * It sits behind the MessagingProvider seam (ADR-0004): it consumes an
 * already-normalized inbound message and drives onboarding -> AI parse -> draft
 * -> confirm -> D1 commit. That behaviour lands in slices 11-13; foundation
 * slice 09 only stands the actor up so its binding boots against real D1 + DO.
 */
export class Coordinator extends Agent<Env> {
  // Onboarding state machine, pending draft, and confirm/commit flow are built
  // in slices 11-13 on top of this.sql + this.schedule.
}
