/**
 * What `env.AI.run` handed back, reduced to one of two honest answers: a text
 * payload we can hand to a parser, or "this is a shape I do not know".
 *
 * There is no third answer, and in particular no empty string — see below.
 */
export type NormalizedAiResponse =
	| { kind: "text"; text: string }
	| { kind: "unrecognized" };

/**
 * The single response-normalization boundary for every Workers AI call
 * (ticket 29 question 5 — a PENDING revision of ADR-0005 §7, not yet written).
 * One implementation, shared by call-1
 * (parsing) and call-2 (reply composition) — two copies would drift, and the
 * drift is invisible until production stops recording.
 *
 * The binding returns different shapes for different models:
 *
 *   llama-3.3-70b / llama-3.1-8b     -> `{ response: ... }`
 *   gemma-sea-lion / glm-4.7-flash   -> `{ choices: [{ message: { content } }] }`
 *
 * An unrecognized shape is a CALL failure, never an empty string. Collapsing to
 * "" is what makes the binding speaking an unexpected dialect look identical to
 * the model failing to answer — the user then gets "aku belum ngerti" and
 * rewrites a message that was never the problem. That collapse has already cost
 * this repo one silent production outage and one wrong research verdict.
 */
export function normalizeAiResponse(output: unknown): NormalizedAiResponse {
	if (typeof output === "string") return { kind: "text", text: output };
	if (output === null || typeof output !== "object") {
		return { kind: "unrecognized" };
	}

	// `.response` is a string for plain-text calls and an already-parsed object
	// under response_format json_schema — both are real payloads, so both are
	// normalized to a string here and the caller keeps a single JSON.parse gate.
	const { response } = output as { response?: unknown };
	if (typeof response === "string") return { kind: "text", text: response };
	if (response !== null && response !== undefined) {
		return { kind: "text", text: JSON.stringify(response) };
	}

	// A reasoning model (glm-4.7-flash) leaves `content` null and spends its
	// token budget in `.reasoning`. Nothing to parse either way, so it lands as
	// a call failure — but deliberately WITHOUT claiming the model rejected the
	// schema. Those are different diagnoses and must not be merged.
	const message = (output as { choices?: { message?: unknown }[] }).choices?.[0]
		?.message as { content?: unknown } | undefined;
	if (typeof message?.content === "string") {
		return { kind: "text", text: message.content };
	}

	return { kind: "unrecognized" };
}
