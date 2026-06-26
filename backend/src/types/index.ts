export type CategorySource = 'rule' | 'knn' | 'llm' | 'manual' | 'keyword' | 'unknown';
export type ImportStatus = 'uploaded' | 'parsing' | 'embedding' | 'categorizing' | 'completed' | 'failed';
export type MatchType = 'merchant_clean' | 'contains' | 'regex';

export interface ImportBatch {
  id: string;
  userId: string;
  status: ImportStatus;
  totalRows: number;
  embeddedRows: number;
  autoCategorizedRows: number;
  needsReviewRows: number;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

export interface Transaction {
  id: number;
  userId: string;
  importBatchId: string;
  postedAt: string;
  amountCents: number;
  currency: string;
  merchantRaw?: string;
  descriptionRaw?: string;
  merchantClean?: string;
  textForEmbedding?: string;
  categoryId?: string;
  categorySource: CategorySource;
  categoryConfidence?: number;
  needsReview: boolean;
  createdAt: string;
}

export interface TransactionEmbedding {
  transactionId: number;
  userId: string;
  embedding: number[];
}

export interface TransactionLabel {
  id: number;
  transactionId: number;
  userId: string;
  oldCategoryId?: string;
  newCategoryId: string;
  labeledBy: string;
  createdAt: string;
}

export interface CategoryRule {
  id: number;
  userId: string;
  matchType: MatchType;
  matchValue: string;
  categoryId: string;
  priority: number;
  enabled: boolean;
  createdFrom: string;
  createdAt: string;
}

export interface ParsedCSVRow {
  date: string;
  amount: number;
  merchant: string;
  description?: string;
  type?: string;
}

