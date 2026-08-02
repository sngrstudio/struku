import { runInDurableObject } from "cloudflare:test";
import type { Coordinator } from "../../src/worker/index";
import type { ParseResult, TextParser } from "../../src/worker/parsing/types";

// Shared by webhook.test.ts and parsing-webhook.test.ts: injects a fake
// TextParser above env.AI (spec Testing Decisions) into a Coordinator DO
// instance, so behavioral tests stay deterministic without calling the real
// model.
export async function injectFakeTextParser(
	coordinatorNamespace: DurableObjectNamespace<Coordinator>,
	userId: string,
	parse: TextParser["parse"],
): Promise<void> {
	const id = coordinatorNamespace.idFromName(userId);
	const stub = coordinatorNamespace.get(id);
	await runInDurableObject(stub, (instance: Coordinator) => {
		instance.textParser = { parse };
	});
}

export function constantParseResult(
	result: ParseResult,
): TextParser["parse"] {
	return async () => result;
}
