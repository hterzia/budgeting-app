export type AccountType = "checking" | "savings" | "credit_card";
export type TransactionType = "income" | "expense" | "transfer" | "refund" | "ignored";
export type CategoryType = "income" | "expense" | "transfer";

export interface Transaction {
  id: string;
  date: string;
  merchant: string;
  amount: number;
  categoryId: string;
  type: TransactionType;
  accountId: string;
  importedAt: string;
  createdAt: string;
  isDeduplicated?: boolean;
  isIgnored?: boolean;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  type: CategoryType;
  color: string;
  icon?: string;
}

export interface Budget {
  id: string;
  month: string;
  categoryId: string;
  limit: number;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
}
