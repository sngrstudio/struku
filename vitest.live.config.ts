import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// Ticket 12: a separate, NON-GATING contract test that exercises the real
// @cf/meta/llama-3.3-70b-instruct-fp8-fast model against the #05 spike
// battery. Deliberately isolated from vitest.config.ts (remoteBindings:
// false there) — this config flips remoteBindings on, so it needs live
// Cloudflare credentials and incurs real Workers AI usage. Run explicitly via
// `npm run test:live`, never as part of `npm test`.
export default defineConfig({
	plugins: [
		cloudflareTest(async () => {
			const migrations = await readD1Migrations(
				path.join(import.meta.dirname, "migrations"),
			);
			return {
				main: "./src/worker/index.ts",
				wrangler: { configPath: "./wrangler.json" },
				remoteBindings: true,
				miniflare: {
					bindings: { TEST_MIGRATIONS: migrations },
				},
			};
		}),
	],
	test: {
		include: ["test/live/**/*.test.ts"],
		setupFiles: ["./test/apply-migrations.ts"],
		testTimeout: 20000, // live model calls; #05 spike p95 ~2.4s but leave margin
	},
});
