export interface BankTemplate {
  name: string;
  headers: string[];
  dateColumn: string;
  datePattern: string;
  amountColumn: string;
  merchantColumn: string;
  typeColumn?: string;
  negativeIsExpense?: boolean;
}

export const bankTemplates: BankTemplate[] = [
  {
    name: "Chase Credit Card",
    headers: ["Transaction Date", "Description", "Type", "Amount"],
    dateColumn: "Transaction Date",
    datePattern: "MM/DD/YYYY",
    amountColumn: "Amount",
    merchantColumn: "Description",
    typeColumn: "Type",
  },
  {
    name: "Chase Checking",
    headers: ["Posting Date", "Description", "Type", "Amount"],
    dateColumn: "Posting Date",
    datePattern: "MM/DD/YYYY",
    amountColumn: "Amount",
    merchantColumn: "Description",
    typeColumn: "Type",
  },
  {
    name: "Amex Credit Card",
    headers: ["Date", "Description", "Amount"],
    dateColumn: "Date",
    datePattern: "MM/DD/YYYY",
    amountColumn: "Amount",
    merchantColumn: "Description",
  },
  {
    name: "Bank of America Credit Card",
    headers: ["Posted Date", "Reference Number", "Payee", "Address", "Amount"],
    dateColumn: "Posted Date",
    datePattern: "MM/DD/YYYY",
    amountColumn: "Amount",
    merchantColumn: "Payee",
    negativeIsExpense: true,
  },
  {
    name: "Bank of America Checking/Savings",
    headers: ["Posted Date", "Reference Number", "Payee", "Address", "Amount"],
    dateColumn: "Posted Date",
    datePattern: "MM/DD/YYYY",
    amountColumn: "Amount",
    merchantColumn: "Payee",
  },
  {
    name: "Revolut",
    headers: ["Start date", "Description", "Amount", "Type"],
    dateColumn: "Start date",
    datePattern: "YYYY-MM-DD",
    amountColumn: "Amount",
    merchantColumn: "Description",
    typeColumn: "Type",
  },
  {
    name: "Wells Fargo",
    headers: ["Date", "Message", "Amount", "Type"],
    dateColumn: "Date",
    datePattern: "MM/DD/YYYY",
    amountColumn: "Amount",
    merchantColumn: "Message",
    typeColumn: "Type",
  },
  {
    name: "Standard CSV",
    headers: ["date", "merchant", "amount", "type"],
    dateColumn: "date",
    datePattern: "YYYY-MM-DD",
    amountColumn: "amount",
    merchantColumn: "merchant",
    typeColumn: "type",
  },
];

export function detectTemplate(headers: string[]): BankTemplate | null {
  const normalizedHeaders = headers.map((h) => h.toLowerCase().trim());

  let bestMatch: BankTemplate | null = null;
  let bestMatchCount = 0;

  for (const template of bankTemplates) {
    const templateHeaders = template.headers.map((h) => h.toLowerCase());
    const match = templateHeaders.every((h) => normalizedHeaders.includes(h));
    if (match && templateHeaders.length > bestMatchCount) {
      bestMatch = template;
      bestMatchCount = templateHeaders.length;
    }
  }
  return bestMatch;
}

export function getField(row: any, fieldNames: string[]): string | undefined {
  for (const name of fieldNames) {
    if (row[name] !== undefined && row[name] !== null) {
      return String(row[name]).trim();
    }
  }
  return undefined;
}

export function normalizeDate(dateStr: string, pattern: string): string {
  if (pattern === "MM/DD/YYYY") {
    const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) {
      return `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
    }
  }
  if (pattern === "YYYY-MM-DD") {
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  }
  // Fallback: try to parse and convert
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  return dateStr;
}

export function parseAmount(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[,$]/g, "").trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

// Keywords that indicate a credit card payment (transfer between own accounts)
const DEFAULT_TRANSFER_KEYWORDS_CHECKING = [
  "credit card",
  "card payment",
  "cc payment",
  "chase credit",
  "chase card",
  "chase crd",
  "capital one",
  "amex",
  "american express",
  "citi card",
  "citi credit",
  "discover card",
  "discover credit",
  "wells fargo card",
  "wells fargo credit",
  "bank of america",
  "barclays",
  "synchrony",
  "apple card",
];

// Keywords on CC statements that indicate a payment received (transfer)
const DEFAULT_TRANSFER_KEYWORDS_CREDIT_CARD = [
  "payment",
  "autopay",
  "auto pay",
  "thank you",
  "payment received",
  "online payment",
  "ach payment",
  "mobile payment",
];

// Keywords on CC statements that indicate a refund
const DEFAULT_REFUND_KEYWORDS = [
  "refund",
  "return",
  "rebate",
  "credit adj",
  "credit memo",
  "reversal",
  "adjustment",
  "dispute",
  "chargeback",
];

const DEFAULT_KNOWN_CHECKING_TRANSFER_KEYWORDS = [
  "online transfer from sav",
  "bk of amer vi/mc online pmt",
];

export type ClassificationKeywordMatchType = "contains" | "regex";

export interface ClassificationKeywordMatcher {
  matchType: ClassificationKeywordMatchType;
  pattern: string;
}

export interface TransactionClassificationConfig {
  checkingTransferKeywords: ClassificationKeywordMatcher[];
  creditCardTransferKeywords: ClassificationKeywordMatcher[];
  refundKeywords: ClassificationKeywordMatcher[];
  knownCheckingTransferKeywords: ClassificationKeywordMatcher[];
}

function asContainsMatchers(patterns: string[]): ClassificationKeywordMatcher[] {
  return patterns.map((pattern) => ({
    matchType: "contains",
    pattern,
  }));
}

function hasKeywordMatch(
  inputLower: string,
  keywords: ClassificationKeywordMatcher[]
): boolean {
  for (const keyword of keywords) {
    if (!keyword.pattern) continue;
    if (keyword.matchType === "contains") {
      if (inputLower.includes(keyword.pattern.toLowerCase())) {
        return true;
      }
      continue;
    }

    try {
      const regex = new RegExp(keyword.pattern, "i");
      if (regex.test(inputLower)) {
        return true;
      }
    } catch {
      // Ignore invalid regex patterns and continue.
    }
  }
  return false;
}

export const DEFAULT_TRANSACTION_CLASSIFICATION_CONFIG: TransactionClassificationConfig = {
  checkingTransferKeywords: asContainsMatchers(DEFAULT_TRANSFER_KEYWORDS_CHECKING),
  creditCardTransferKeywords: asContainsMatchers(DEFAULT_TRANSFER_KEYWORDS_CREDIT_CARD),
  refundKeywords: asContainsMatchers(DEFAULT_REFUND_KEYWORDS),
  knownCheckingTransferKeywords: asContainsMatchers(DEFAULT_KNOWN_CHECKING_TRANSFER_KEYWORDS),
};

// AccountType and TransactionType are used for type inference but not strictly
// enforced at the database level (use lookup tables for extensibility)
export type AccountType = string;
export type TransactionType =
  | "income"
  | "expense"
  | "transfer"
  | "refund"
  | "ignored";

export function classifyTransaction(
  merchant: string,
  amount: number,
  accountType: AccountType,
  typeColumn?: string,
  config: TransactionClassificationConfig = DEFAULT_TRANSACTION_CLASSIFICATION_CONFIG,
): TransactionType {
  const lower = merchant.toLowerCase();
  const typeUpper = typeColumn?.toUpperCase();
  const isKnownCheckingTransfer = hasKeywordMatch(
    lower,
    config.knownCheckingTransferKeywords,
  );

  // Credit card with Type column (Chase, Capital One, etc.)
  if (accountType === "credit_card" && typeUpper) {
    if (typeUpper === "PAYMENT") {
      if (hasKeywordMatch(lower, config.refundKeywords)) {
        return "refund";
      }
      return "transfer";
    }
    if (typeUpper === "RETURN" || typeUpper === "REFUND") {
      return "refund";
    }
    if (typeUpper === "SALE" || typeUpper === "PURCHASE") {
      return "expense";
    }
  }

  // Chase Checking: Type column has "DEBIT" or "CREDIT"
  if ((accountType === "checking" || accountType === "savings") && typeUpper) {
    if (isKnownCheckingTransfer) {
      return "transfer";
    }
    if (typeUpper === "CREDIT") {
      // Check if it's a refund (money coming back)
      if (hasKeywordMatch(lower, config.refundKeywords)) {
        return "refund";
      }
      return "income";
    }
    if (typeUpper === "DEBIT") {
      // Check if it's a CC payment (transfer)
      if (hasKeywordMatch(lower, config.checkingTransferKeywords)) {
        return "transfer";
      }
      return "expense";
    }
  }

  // Fallback logic based on amount sign and keywords
  if (accountType === "credit_card") {
    // Amex-style: negative amounts are credits/payments, positive are charges
    if (amount < 0) {
      if (hasKeywordMatch(lower, config.refundKeywords)) {
        return "refund";
      }
      if (hasKeywordMatch(lower, config.creditCardTransferKeywords)) {
        return "transfer";
      }
      // Statement credits (e.g., Amex "Platinum Digital Entertainment Credit")
      if (lower.endsWith("credit") || lower.includes("statement credit")) {
        return "refund";
      }
      return "transfer";
    }
    return "expense";
  }

  if (accountType === "checking" || accountType === "savings") {
    if (isKnownCheckingTransfer) {
      return "transfer";
    }
    if (amount < 0) {
      if (hasKeywordMatch(lower, config.checkingTransferKeywords)) {
        return "transfer";
      }
      return "expense";
    }
    return "income";
  }

  return amount < 0 ? "expense" : "income";
}
