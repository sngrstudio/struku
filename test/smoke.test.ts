import { env, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { Coordinator } from "../src/worker/index";
import { DEFAULT_CHART_OF_ACCOUNTS } from "../src/worker/ledger/chart-of-accounts";

// Foundation smoke test (ticket 09): the Worker boots against real D1 + DO
// bindings, the ledger-core migration is applied, and the reference seed is
// present. This establishes the vitest-pool-workers harness slices 10-13 build
// their behavioural tests on.

describe("ledger-core migration", () => {
	it("creates exactly the six ADR-0002 ledger-core tables", async () => {
		const { results } = await env.DB.prepare(
			`SELECT name FROM sqlite_master
			 WHERE type = 'table'
			   AND name NOT LIKE 'sqlite_%'
			   AND name NOT LIKE '_cf_%'
			   AND name != 'd1_migrations'
			 ORDER BY name`,
		).all<{ name: string }>();

		expect(results.map((r) => r.name)).toEqual([
			"accounts",
			"channel_identities",
			"currencies",
			"journal_entries",
			"journal_lines",
			"users",
		]);
	});

	it("adds users.onboarding_completed_at as a nullable column (ADR-0003)", async () => {
		const { results } = await env.DB.prepare(`PRAGMA table_info(users)`).all<{
			name: string;
			notnull: number;
		}>();

		const col = results.find((c) => c.name === "onboarding_completed_at");
		expect(col).toBeDefined();
		expect(col?.notnull).toBe(0); // nullable
	});

	it("seeds reference currencies IDR (exp 0) and USD (exp 2)", async () => {
		const { results } = await env.DB.prepare(
			`SELECT code, exponent FROM currencies ORDER BY code`,
		).all<{ code: string; exponent: number }>();

		expect(results).toEqual([
			{ code: "IDR", exponent: 0 },
			{ code: "USD", exponent: 2 },
		]);
	});

	it("enforces the asset/liability currency CHECK constraint (both branches)", async () => {
		await env.DB.prepare(
			`INSERT INTO users (id, created_at) VALUES ('u_check', 0)`,
		).run();

		// Branch 1: an asset account with NULL currency violates ADR-0002 §4.
		await expect(
			env.DB.prepare(
				`INSERT INTO accounts (id, user_id, slug, type, name, currency, is_default, created_at)
				 VALUES ('a_asset_nocur', 'u_check', 'cash', 'asset', 'Cash', NULL, 1, 0)`,
			).run(),
		).rejects.toThrow();

		// Branch 2: an income/expense account that declares a currency also violates it.
		await expect(
			env.DB.prepare(
				`INSERT INTO accounts (id, user_id, slug, type, name, currency, is_default, created_at)
				 VALUES ('a_income_cur', 'u_check', 'income_salary', 'income', 'Salary', 'IDR', 0, 0)`,
			).run(),
		).rejects.toThrow();
	});

	it("enforces UNIQUE (user_id, slug) on accounts", async () => {
		await env.DB.prepare(
			`INSERT INTO users (id, created_at) VALUES ('u_uniq', 0)`,
		).run();
		await env.DB.prepare(
			`INSERT INTO accounts (id, user_id, slug, type, name, currency, is_default, created_at)
			 VALUES ('a1', 'u_uniq', 'expense_food', 'expense', 'Food', NULL, 0, 0)`,
		).run();

		await expect(
			env.DB.prepare(
				`INSERT INTO accounts (id, user_id, slug, type, name, currency, is_default, created_at)
				 VALUES ('a2', 'u_uniq', 'expense_food', 'expense', 'Makan', NULL, 0, 0)`,
			).run(),
		).rejects.toThrow();
	});

	it("enforces the amount_minor > 0 and direction/source enum CHECKs", async () => {
		// Seed valid FK parents so a CHECK/enum violation is the *only* possible
		// rejection reason (not an incidental foreign-key failure).
		await env.DB.prepare(
			`INSERT INTO users (id, created_at) VALUES ('u_j', 0)`,
		).run();
		await env.DB.prepare(
			`INSERT INTO accounts (id, user_id, slug, type, name, currency, is_default, created_at)
			 VALUES ('a_j', 'u_j', 'expense_food', 'expense', 'Food', NULL, 0, 0)`,
		).run();
		await env.DB.prepare(
			`INSERT INTO journal_entries (id, user_id, entry_date, source, currency, created_at)
			 VALUES ('e_j', 'u_j', '2026-07-31', 'text', 'IDR', 0)`,
		).run();

		// amount_minor > 0 CHECK (ADR-0002 §DDL): a zero amount is rejected.
		await expect(
			env.DB.prepare(
				`INSERT INTO journal_lines (id, user_id, entry_id, account_id, direction, amount_minor, currency)
				 VALUES ('l_zero', 'u_j', 'e_j', 'a_j', 'debit', 0, 'IDR')`,
			).run(),
		).rejects.toThrow();

		// direction enum: only 'debit'|'credit' allowed.
		await expect(
			env.DB.prepare(
				`INSERT INTO journal_lines (id, user_id, entry_id, account_id, direction, amount_minor, currency)
				 VALUES ('l_dir', 'u_j', 'e_j', 'a_j', 'sideways', 100, 'IDR')`,
			).run(),
		).rejects.toThrow();

		// source enum on journal_entries: only 'text'|'image' allowed.
		await expect(
			env.DB.prepare(
				`INSERT INTO journal_entries (id, user_id, entry_date, source, currency, created_at)
				 VALUES ('e_bad_src', 'u_j', '2026-07-31', 'telepathy', 'IDR', 0)`,
			).run(),
		).rejects.toThrow();
	});
});

describe("coordination actor (Agents SDK DO)", () => {
	it("boots a Coordinator agent instance from its binding", async () => {
		const id = env.Coordinator.idFromName("smoke");
		const stub = env.Coordinator.get(id);

		await runInDurableObject(stub, (instance: Coordinator) => {
			expect(instance).toBeInstanceOf(Coordinator);
		});
	});
});

describe("default chart of accounts seed", () => {
	it("captures all 16 canonical accounts, currency policy matching account type", () => {
		expect(DEFAULT_CHART_OF_ACCOUNTS).toHaveLength(16);

		for (const account of DEFAULT_CHART_OF_ACCOUNTS) {
			const holdsBalance =
				account.type === "asset" || account.type === "liability";
			// asset/liability get the user's primary currency; everything else null.
			expect(account.currency === "primary").toBe(holdsBalance);
		}
	});
});
