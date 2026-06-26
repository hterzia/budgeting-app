/**
 * CSV parsing utilities for the frontend.
 * Shared with backend in backend/src/utils/csv.ts
 */

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
    name: 'Chase Credit Card',
    headers: ['Transaction Date', 'Description', 'Type', 'Amount'],
    dateColumn: 'Transaction Date',
    datePattern: 'MM/DD/YYYY',
    amountColumn: 'Amount',
    merchantColumn: 'Description',
    typeColumn: 'Type',
  },
  {
    name: 'Chase Checking',
    headers: ['Posting Date', 'Description', 'Type', 'Amount'],
    dateColumn: 'Posting Date',
    datePattern: 'MM/DD/YYYY',
    amountColumn: 'Amount',
    merchantColumn: 'Description',
    typeColumn: 'Type',
  },
  {
    name: 'Amex Credit Card',
    headers: ['Date', 'Description', 'Amount'],
    dateColumn: 'Date',
    datePattern: 'MM/DD/YYYY',
    amountColumn: 'Amount',
    merchantColumn: 'Description',
  },
  {
    name: 'Bank of America Credit Card',
    headers: ['Posted Date', 'Reference Number', 'Payee', 'Address', 'Amount'],
    dateColumn: 'Posted Date',
    datePattern: 'MM/DD/YYYY',
    amountColumn: 'Amount',
    merchantColumn: 'Payee',
    negativeIsExpense: true,
  },
  {
    name: 'Bank of America Checking/Savings',
    headers: ['Posted Date', 'Reference Number', 'Payee', 'Address', 'Amount'],
    dateColumn: 'Posted Date',
    datePattern: 'MM/DD/YYYY',
    amountColumn: 'Amount',
    merchantColumn: 'Payee',
  },
  {
    name: 'Revolut',
    headers: ['Start date', 'Description', 'Amount', 'Type'],
    dateColumn: 'Start date',
    datePattern: 'YYYY-MM-DD',
    amountColumn: 'Amount',
    merchantColumn: 'Description',
    typeColumn: 'Type',
  },
  {
    name: 'Wells Fargo',
    headers: ['Date', 'Message', 'Amount', 'Type'],
    dateColumn: 'Date',
    datePattern: 'MM/DD/YYYY',
    amountColumn: 'Amount',
    merchantColumn: 'Message',
    typeColumn: 'Type',
  },
  {
    name: 'Standard CSV',
    headers: ['date', 'merchant', 'amount', 'type'],
    dateColumn: 'date',
    datePattern: 'YYYY-MM-DD',
    amountColumn: 'amount',
    merchantColumn: 'merchant',
    typeColumn: 'type',
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
