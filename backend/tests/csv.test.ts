/**
 * Regression tests for backend CSV parsing utilities
 */

import { describe, it, expect } from 'vitest';
import {
  getField,
  normalizeDate,
  parseAmount,
  detectTemplate,
  classifyTransaction,
} from '../src/utils/csv.js';

describe('getField', () => {
  it('returns first matching field value', () => {
    const row = { name: 'John', Name: 'Jane', NAME: 'Bob' };
    expect(getField(row, ['name', 'Name', 'NAME'])).toBe('John');
  });

  it('handles case-insensitive matching', () => {
    const row = { Description: 'Test' };
    expect(getField(row, ['description', 'Description', 'DESC'])).toBe('Test');
  });

  it('returns undefined when no field matches', () => {
    const row = { foo: 'bar' };
    expect(getField(row, ['name', 'description', 'amount'])).toBeUndefined();
  });

  it('trims whitespace from values', () => {
    const row = { name: '  John Doe  ' };
    expect(getField(row, ['name'])).toBe('John Doe');
  });

  it('handles null values', () => {
    const row = { name: null, description: 'Test' };
    expect(getField(row, ['name', 'description'])).toBe('Test');
  });

  it('handles undefined values', () => {
    const row = { name: undefined, description: 'Test' };
    expect(getField(row, ['name', 'description'])).toBe('Test');
  });
});

describe('normalizeDate', () => {
  it('normalizes MM/DD/YYYY to YYYY-MM-DD', () => {
    expect(normalizeDate('03/15/2024', 'MM/DD/YYYY')).toBe('2024-03-15');
    expect(normalizeDate('1/5/2024', 'MM/DD/YYYY')).toBe('2024-01-05');
  });

  it('returns YYYY-MM-DD as-is', () => {
    expect(normalizeDate('2024-03-15', 'YYYY-MM-DD')).toBe('2024-03-15');
  });

  it('handles fallback date parsing', () => {
    const result = normalizeDate('March 15, 2024', 'MM/DD/YYYY');
    // Just verify it returns a valid date string
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns original string if parsing fails', () => {
    expect(normalizeDate('invalid-date', 'MM/DD/YYYY')).toBe('invalid-date');
  });
});

describe('parseAmount', () => {
  it('parses simple numbers', () => {
    expect(parseAmount('123.45')).toBe(123.45);
  });

  it('handles negative amounts', () => {
    expect(parseAmount('-15.99')).toBe(-15.99);
  });

  it('removes currency symbols and commas', () => {
    expect(parseAmount('$1,234.56')).toBe(1234.56);
    expect(parseAmount('-$500.00')).toBe(-500);
  });

  it('returns 0 for empty input', () => {
    expect(parseAmount('')).toBe(0);
  });

  it('returns 0 for undefined', () => {
    expect(parseAmount(undefined)).toBe(0);
  });

  it('returns 0 for non-numeric strings', () => {
    expect(parseAmount('not-a-number')).toBe(0);
  });
});

describe('detectTemplate', () => {
  it('detects Chase Credit Card template', () => {
    const headers = ['Transaction Date', 'Description', 'Type', 'Amount'];
    const template = detectTemplate(headers);
    expect(template?.name).toBe('Chase Credit Card');
  });

  it('detects lowercase headers', () => {
    const headers = ['date', 'description', 'amount'];
    const template = detectTemplate(headers);
    expect(template?.name).toBe('Amex Credit Card');
  });

  it('returns null when no template matches', () => {
    const headers = ['foo', 'bar', 'baz'];
    expect(detectTemplate(headers)).toBeNull();
  });

  it('selects best matching template', () => {
    const headers = ['Date', 'Description', 'Amount', 'Type', 'Extra'];
    const template = detectTemplate(headers);
    // Should prefer Amex (3 headers) over Standard CSV (4 headers) since Amex is subset
    expect(template?.name).toBe('Amex Credit Card');
  });

  it('detects Bank of America template', () => {
    const headers = ['Posted Date', 'Reference Number', 'Payee', 'Address', 'Amount'];
    const template = detectTemplate(headers);
    expect(template?.name).toBe('Bank of America Credit Card');
  });

  it('detects Revolut template', () => {
    const headers = ['Start date', 'Description', 'Amount', 'Type'];
    const template = detectTemplate(headers);
    expect(template?.name).toBe('Revolut');
  });
});

describe('classifyTransaction', () => {
  it('classifies credit card payment as transfer', () => {
    const result = classifyTransaction(
      'Chase Credit Card Payment',
      -1000,
      'credit_card',
      'payment'
    );
    expect(result).toBe('transfer');
  });

  it('classifies refund based on keywords', () => {
    const result = classifyTransaction(
      'Netflix Refund',
      15.99,
      'credit_card',
      'refund'
    );
    expect(result).toBe('refund');
  });

  it('classifies purchase as expense for credit card', () => {
    const result = classifyTransaction(
      'Netflix Subscription',
      15.99,
      'credit_card',
      'purchase'
    );
    expect(result).toBe('expense');
  });

  it('classifies income for checking credit transaction', () => {
    const result = classifyTransaction(
      'Salary Deposit',
      5000,
      'checking',
      'credit'
    );
    expect(result).toBe('income');
  });

  it('classifies expense for checking debit transaction', () => {
    const result = classifyTransaction(
      'Grocery Store',
      -150,
      'checking',
      'debit'
    );
    expect(result).toBe('expense');
  });

  it('classifies transfer for checking debit with transfer keyword', () => {
    const result = classifyTransaction(
      'Credit Card Payment',
      -1000,
      'checking',
      'debit'
    );
    expect(result).toBe('transfer');
  });

  it('classifies based on amount sign for credit card', () => {
    // Negative = payment/credit (transfer)
    const result1 = classifyTransaction('Some Charge', -50, 'credit_card', undefined);
    expect(result1).toBe('transfer');

    // Positive = charge (expense)
    const result2 = classifyTransaction('Some Charge', 50, 'credit_card', undefined);
    expect(result2).toBe('expense');
  });

  it('classifies based on amount sign for checking', () => {
    // Negative = expense
    const result1 = classifyTransaction('Groceries', -100, 'checking', undefined);
    expect(result1).toBe('expense');

    // Positive = income
    const result2 = classifyTransaction('Paycheck', 5000, 'checking', undefined);
    expect(result2).toBe('income');
  });
});
