import { describe, expect, it } from "vitest";
import { normalizeAiResponse } from "../src/worker/parsing/normalize-ai-response";

// Ticket 29 question 5: ONE response-normalization boundary, shared by both
// model calls, understanding both shapes the binding actually returns —
//
//   llama-3.3-70b / llama-3.1-8b     -> { response: ... }
//   gemma-sea-lion / glm-4.7-flash   -> OpenAI chat completion,
//                                       { choices: [{ message: { content } }] }
//
// — and, above all, NEVER collapsing an unrecognized shape to "". That collapse
// is the silent failure mode that has now burned this repo twice: the payload
// disappears, the parse "fails", and the user is told "aku belum ngerti" for a
// message the model answered perfectly. Ticket 25's probe scored SEA-LION as a
// total failure that way while it was in fact the best candidate.
//
// This is a prerequisite, not hardening: the model ticket 25 picked for call-2
// returns the `choices` shape TODAY.

describe("normalizeAiResponse", () => {
	it("reads a bare string", () => {
		expect(normalizeAiResponse('{"intent":"query"}')).toEqual({
			kind: "text",
			text: '{"intent":"query"}',
		});
	});

	it("reads a string-valued .response (llama plain-text shape)", () => {
		expect(normalizeAiResponse({ response: '{"intent":"query"}' })).toEqual({
			kind: "text",
			text: '{"intent":"query"}',
		});
	});

	it("reads an object-valued .response (llama json_schema shape)", () => {
		expect(normalizeAiResponse({ response: { intent: "query" } })).toEqual({
			kind: "text",
			text: '{"intent":"query"}',
		});
	});

	it("reads choices[0].message.content (the SEA-LION shape call-2 uses today)", () => {
		const output = {
			choices: [{ message: { role: "assistant", content: '{"reply":"oke"}' } }],
		};

		expect(normalizeAiResponse(output)).toEqual({
			kind: "text",
			text: '{"reply":"oke"}',
		});
	});

	// The exact shape that made production stop recording: `.response` absent,
	// payload sitting somewhere this boundary does not know. Loud, not silent.
	it("reports an unrecognized shape instead of collapsing it to an empty string", () => {
		expect(normalizeAiResponse({ output_text: "surprise" })).toEqual({
			kind: "unrecognized",
		});
	});

	it("reports a null .response as unrecognized — a present key with no payload is still no payload", () => {
		expect(normalizeAiResponse({ response: null })).toEqual({
			kind: "unrecognized",
		});
	});

	// glm-4.7-flash is a reasoning model: it leaves `content` null and spends the
	// token budget in `.reasoning`. There is nothing to parse, so it is a call
	// failure — but it is NOT evidence that json_schema is unsupported, and the
	// two must not be conflated (ticket 29 run-2).
	it("reports a reasoning-model reply (content null) as unrecognized", () => {
		const output = {
			choices: [{ message: { content: null, reasoning: "thinking out loud" } }],
		};

		expect(normalizeAiResponse(output)).toEqual({ kind: "unrecognized" });
	});

	it("reports null and non-object outputs as unrecognized", () => {
		expect(normalizeAiResponse(null)).toEqual({ kind: "unrecognized" });
		expect(normalizeAiResponse(undefined)).toEqual({ kind: "unrecognized" });
		expect(normalizeAiResponse(42)).toEqual({ kind: "unrecognized" });
	});

	// A recognized shape carrying an empty string is the MODEL saying nothing,
	// not the BINDING speaking a dialect we can't read. It stays on the parse
	// path (retry, then "aku belum ngerti") — ADR-0005 §7 is untouched by this
	// boundary.
	it("keeps an empty string payload on the parse path, not the call-failure path", () => {
		expect(normalizeAiResponse({ response: "" })).toEqual({
			kind: "text",
			text: "",
		});
	});
});
