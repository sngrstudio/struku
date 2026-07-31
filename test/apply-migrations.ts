import { applyD1Migrations, env } from "cloudflare:test";

// Storage in vitest-pool-workers is isolated per test file, so this setup file
// (re)applies the ledger-core migration to a fresh D1 before every file's tests.
// TEST_MIGRATIONS is injected by vitest.config.ts via readD1Migrations().
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS!);
