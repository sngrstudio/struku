import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// Vitest 4 + @cloudflare/vitest-pool-workers: the `cloudflareTest()` plugin
// replaced the removed `defineWorkersConfig`/poolOptions.workers form.
// The async factory reads the hand-written D1 migrations at load time and
// injects them as a test-only binding, which `test/apply-migrations.ts` then
// applies to the real (miniflare-simulated) D1 before each test file runs.
export default defineConfig({
	plugins: [
		cloudflareTest(async () => {
			const migrations = await readD1Migrations(
				path.join(import.meta.dirname, "migrations"),
			);
			return {
				main: "./src/worker/index.ts",
				wrangler: { configPath: "./wrangler.json" },
				// Keep the suite hermetic: never open a remote connection for the AI
				// binding at startup. Behavioural tests inject a fake TextParser above
				// env.AI (per spec Testing Decisions), so AI is never called in the
				// gate — the live-model contract test is a separate, non-gating run.
				remoteBindings: false,
				miniflare: {
					bindings: { TEST_MIGRATIONS: migrations },
				},
			};
		}),
	],
	test: {
		setupFiles: ["./test/apply-migrations.ts"],
	},
});
