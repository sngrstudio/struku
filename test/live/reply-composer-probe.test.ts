import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

// Ticket 25 probe — TEMPORARY, delete once its numbers are recorded in
// .scratch/struku-daily/research/25-small-model-for-reply-composition.md.
//
// Non-gating: test/live/** is excluded from `npm test` (vitest.config.ts) and
// only runs via `npm run test:live`, which needs live Cloudflare credentials
// and burns real Workers AI neurons. It releases nothing, so it sits outside
// the deployment freeze.
//
// What it answers, per ticket 25 "Cara memverifikasi":
//   1. does each candidate honour response_format json_schema on a FLAT
//      { reply, summary } object (ADR-0005 §1's nested-schema whitespace
//      spiral must not come back),
//   2. how long each call takes next to the 70B numbers in ADR-0005 §2
//      (p50 ~1.7s / p95 ~2.4s), since two calls now run back to back inside
//      NFR-PERF-01's 5-10s,
//   3. whether the model leaves {slot} placeholders alone instead of writing
//      numbers itself (ticket 15 butir 1 — the app fills the numbers),
//   4. whether the Indonesian reads like a person wrote it.
//
// The reporter swallows console.log, so the transcript is forced out through a
// deliberately failing assertion in the last test. Read it there.

// Ranked by ticket 25's research. The order IS the experiment: 70B first as the
// only model whose json_schema support is proven here (ADR-0005 §2), then the
// candidates in the order they are worth disproving.
//
// Copy these ids from the live catalogue before trusting them — research 25 §1
// found the pricing page and the model pages disagreeing on 8B naming
// (`-fp8-fast` vs `-fast`), and a wrong id fails at RUNTIME, not build time.
const CANDIDATES = [
	"@cf/meta/llama-3.3-70b-instruct-fp8-fast", // ADR-0005 §2 baseline: p50 ~1.7s / p95 ~2.4s
	"@cf/zai-org/glm-4.7-flash", // primary: dialogue-tuned, 100+ languages, json_schema UNVERIFIED
	"@cf/aisingapore/gemma-sea-lion-v4-27b-it", // backup: the only model whose docs name Indonesian
	"@cf/meta/llama-3.1-8b-instruct-fast", // control only: does "smaller = faster" hold at all?
] as const;

// The flat two-string contract from ticket 15 butir 5.
const REPLY_JSON_SCHEMA = {
	type: "object",
	properties: {
		reply: { type: "string" },
		summary: { type: "string" },
	},
	required: ["reply", "summary"],
} as const;

const SYSTEM_PROMPT = [
	"You are Struku, a personal-finance chat bot. The user's language is Indonesian (id);",
	"write casual, warm, short Indonesian — one or two sentences, no bullet points.",
	"You are given the result of an action the app already performed.",
	"NEVER write a number yourself. Use the placeholders exactly as given:",
	"{amount}, {category}, {total_harian}. The app substitutes the real values.",
	'Return two fields: "reply" (what the user reads) and "summary" (a one-line',
	"running summary of the conversation so far, in Indonesian, for the next turn).",
].join(" ");

// One committed expense: the highest-traffic reply in the product today.
const USER_TURN = [
	"Action: recorded an expense.",
	"amount={amount} category={category} today_total={total_harian}",
	'User said: "warteg 25rb"',
	"Previous summary: (none — first message today)",
].join("\n");

type Probe = {
	model: string;
	ms: number;
	ok: boolean;
	note: string;
	reply: string;
	summary: string;
	raw: string;
};

function normalize(output: unknown): string {
	// Same normalization as workers-ai-text-parser.ts:92-110 — the binding hands
	// back an already-parsed object for json_schema calls on some runtimes and a
	// JSON string on others, and only accepting the string form once silently
	// produced "" for every live call.
	if (typeof output === "string") return output;
	if (output && typeof output === "object" && "response" in output) {
		const { response } = output as { response: unknown };
		if (typeof response === "string") return response;
		if (response !== null && response !== undefined) {
			return JSON.stringify(response);
		}
	}
	return "";
}

const probes: Probe[] = [];

describe("ticket 25: reply-composition candidates (live)", () => {
	for (const model of CANDIDATES) {
		it(`${model} returns a flat { reply, summary }`, async () => {
			const started = Date.now();
			let raw = "";
			let note = "";
			let rawOutput: unknown;
			try {
				const output = await env.AI.run(
					model as Parameters<Ai["run"]>[0],
					{
						messages: [
							{ role: "system", content: SYSTEM_PROMPT },
							{ role: "user", content: USER_TURN },
						],
						response_format: {
							type: "json_schema",
							json_schema: REPLY_JSON_SCHEMA,
						},
						max_tokens: 512, // ADR-0005 §2: the 256 default truncates on 70B.
					} as Parameters<Ai["run"]>[1],
				);
				rawOutput = output;
				raw = normalize(output);
			} catch (error) {
				// A model that rejects json_schema outright fails HERE, and that is
				// itself the finding ticket 25 question 2 asks for — it invalidates
				// ticket 15 butir 5's contract for that candidate.
				note = `threw: ${error instanceof Error ? error.message : String(error)}`;
			}
			const ms = Date.now() - started;

			let reply = "";
			let summary = "";
			let ok = false;
			if (!raw && !note) {
				// Run 1 (2026-08-03) hit this on glm-4.7-flash and gemma-sea-lion:
				// normalize() collapsed the payload to "" and the run could not tell
				// "model ignored json_schema" apart from "binding returned a shape
				// normalize() does not know" — the same ambiguity as the scar at
				// workers-ai-text-parser.ts:94-102. Keep the untouched payload so the
				// next run can tell them apart.
				note = `empty after normalize; raw payload = ${JSON.stringify(rawOutput)?.slice(0, 300)}`;
			}
			if (raw) {
				try {
					const parsed = JSON.parse(raw) as Record<string, unknown>;
					reply = typeof parsed.reply === "string" ? parsed.reply : "";
					summary = typeof parsed.summary === "string" ? parsed.summary : "";
					ok = reply.length > 0 && summary.length > 0;
					if (!ok) note ||= "parsed, but reply/summary missing or not a string";
				} catch {
					note ||= "response was not valid JSON";
				}
			} else if (!note) {
				note = "empty response (the .response-shape scar, parser lines 94-102)";
			}

			// Whitespace spiral check (ADR-0005 §1): the nested-schema failure mode
			// was runaway padding, not a wrong answer.
			const padding = raw.length - raw.replace(/\s/g, "").length;
			if (ok && padding > raw.length * 0.5) {
				note ||= `whitespace-heavy: ${padding}/${raw.length} chars`;
			}
			// Slot discipline (ticket 15 butir 1): the app fills the values, not the
			// model. Run 1 checked only digits and {amount}, and MISSED the real
			// violation: 70B wrote the user's own word ("warteg") where {category}
			// belonged, so the app had nothing to substitute. Every slot is checked
			// now, and a slot silently replaced by prose is the failure to catch.
			const SLOTS = ["{amount}", "{category}", "{total_harian}"];
			if (ok) {
				if (/\d/.test(reply)) {
					note ||= "wrote a digit into reply instead of leaving the slot";
				}
				const dropped = SLOTS.filter((slot) => !reply.includes(slot));
				if (dropped.length > 0) {
					note ||= `dropped slot(s) from reply: ${dropped.join(", ")}`;
				}
			}

			probes.push({ model, ms, ok, note, reply, summary, raw });

			// Non-gating on purpose: a candidate failing is data, not a broken build.
			expect(probes.length).toBeGreaterThan(0);
		});
	}

	it("PRINTS THE TRANSCRIPT — this failure is the report, not a bug", () => {
		const report = probes
			.map(
				(p) =>
					[
						`--- ${p.model}`,
						`    ${p.ms}ms  json_schema_ok=${p.ok}${p.note ? `  note=${p.note}` : ""}`,
						`    reply:   ${p.reply || "(none)"}`,
						`    summary: ${p.summary || "(none)"}`,
						`    raw:     ${p.raw.slice(0, 400)}`,
					].join("\n"),
			)
			.join("\n");
		expect(report).toBe("READ THE ACTUAL VALUE ABOVE");
	});
});
