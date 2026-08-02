/**
 * Canonical default chart of accounts (ADR-0002 §5, FR-LDG-01 / FR-ONB-04).
 *
 * This is the single source of truth for the accounts seeded per-user at
 * provisioning (slice 11 — NOT inserted by the ledger-core migration, which is
 * user-agnostic). Each entry maps a stable `slug` -> account `type` -> default
 * display `name` -> currency policy.
 *
 * `currency: 'primary'` means the account is opened in the user's primary
 * reporting currency (default IDR); `currency: null` means the account holds no
 * currency (equity/income/expense categories absorb any currency — ADR-0002 §4).
 * The CHECK constraint in migration 0001 enforces exactly this asset/liability
 * vs equity/income/expense split, so this table must stay consistent with it.
 */

export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

/** 'primary' resolves to the user's primary currency; null = no currency. */
export type CurrencyPolicy = 'primary' | null;

export interface ChartOfAccountsEntry {
  readonly slug: string;
  readonly type: AccountType;
  readonly defaultName: string;
  readonly currency: CurrencyPolicy;
}

export const DEFAULT_CHART_OF_ACCOUNTS: readonly ChartOfAccountsEntry[] = [
  { slug: 'cash', type: 'asset', defaultName: 'Cash', currency: 'primary' },
  { slug: 'bank', type: 'asset', defaultName: 'Bank Account', currency: 'primary' },
  { slug: 'ewallet', type: 'asset', defaultName: 'E-Wallet', currency: 'primary' },
  { slug: 'credit_card', type: 'liability', defaultName: 'Credit Card', currency: 'primary' },
  { slug: 'personal_debt', type: 'liability', defaultName: 'Personal Debt', currency: 'primary' },
  { slug: 'opening_balance', type: 'equity', defaultName: 'Opening Balance', currency: null },
  { slug: 'income_salary', type: 'income', defaultName: 'Salary', currency: null },
  { slug: 'income_freelance', type: 'income', defaultName: 'Freelance Income', currency: null },
  { slug: 'income_other', type: 'income', defaultName: 'Other Income', currency: null },
  { slug: 'expense_food', type: 'expense', defaultName: 'Food', currency: null },
  { slug: 'expense_transportation', type: 'expense', defaultName: 'Transportation', currency: null },
  { slug: 'expense_shopping', type: 'expense', defaultName: 'Shopping', currency: null },
  { slug: 'expense_bills_utilities', type: 'expense', defaultName: 'Bills & Utilities', currency: null },
  { slug: 'expense_entertainment', type: 'expense', defaultName: 'Entertainment', currency: null },
  { slug: 'expense_healthcare', type: 'expense', defaultName: 'Healthcare', currency: null },
  { slug: 'expense_other', type: 'expense', defaultName: 'Other', currency: null },
] as const;
