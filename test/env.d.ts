import type { D1Migration } from "@cloudflare/vitest-pool-workers";

// Test-only binding injected by vitest.config.ts (not part of wrangler.json, so
// `wrangler types` does not know about it). Augment the generated Cloudflare.Env.
declare global {
	namespace Cloudflare {
		interface Env {
			// Optional so the production `Env` still satisfies `Cloudflare.Env`
			// (this binding exists only under the test pool). Present at runtime in
			// tests; asserted non-null where consumed.
			TEST_MIGRATIONS?: D1Migration[];
		}
	}
}

export {};
