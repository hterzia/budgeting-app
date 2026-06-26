import { describe, it, expect } from 'vitest';
import { keywordCategorize } from '../src/services/keywordCategorize.js';

describe('keywordCategorize', () => {
  const allCategories = new Set([
    'groceries', 'dining', 'transportation', 'utilities', 'housing',
    'healthcare', 'entertainment', 'shopping', 'travel', 'insurance',
    'education', 'personal-care', 'subscriptions', 'salary', 'transfers',
  ]);

  it('categorizes "Starbucks" as dining', () => {
    const result = keywordCategorize(
      { merchantClean: 'Starbucks', descriptionRaw: '', amountCents: -500, type: 'expense' },
      allCategories
    );
    expect(result.categoryId).toBe('dining');
  });

  it('categorizes "Whole Foods" as groceries', () => {
    const result = keywordCategorize(
      { merchantClean: 'Whole Foods Market', descriptionRaw: '', amountCents: -8500, type: 'expense' },
      allCategories
    );
    expect(result.categoryId).toBe('groceries');
  });

  it('categorizes "Uber" as transportation', () => {
    const result = keywordCategorize(
      { merchantClean: 'Uber', descriptionRaw: 'Trip', amountCents: -2500, type: 'expense' },
      allCategories
    );
    expect(result.categoryId).toBe('transportation');
  });

  it('categorizes income transactions as salary', () => {
    const result = keywordCategorize(
      { merchantClean: 'ADP Payroll', descriptionRaw: 'Direct Deposit', amountCents: 500000, type: 'income' },
      allCategories
    );
    expect(result.categoryId).toBe('salary');
  });

  it('returns null for unrecognizable merchants', () => {
    const result = keywordCategorize(
      { merchantClean: 'XYZZY Corp', descriptionRaw: '', amountCents: -1000, type: 'expense' },
      allCategories
    );
    expect(result.categoryId).toBeNull();
  });

  it('skips categories not in validCategoryIds', () => {
    const limited = new Set(['groceries']);
    const result = keywordCategorize(
      { merchantClean: 'Starbucks', descriptionRaw: '', amountCents: -500, type: 'expense' },
      limited
    );
    expect(result.categoryId).toBeNull();
  });

  it('matches short keywords like "gas" and "gym"', () => {
    const gas = keywordCategorize(
      { merchantClean: 'Gas Station', descriptionRaw: '', amountCents: -4500, type: 'expense' },
      allCategories
    );
    expect(gas.categoryId).toBe('transportation');

    const gym = keywordCategorize(
      { merchantClean: 'Planet Gym', descriptionRaw: '', amountCents: -3000, type: 'expense' },
      allCategories
    );
    expect(gym.categoryId).toBe('personal-care');
  });

  it('uses description_raw for matching too', () => {
    const result = keywordCategorize(
      { merchantClean: '', descriptionRaw: 'Netflix subscription', amountCents: -1599, type: 'expense' },
      allCategories
    );
    expect(result.categoryId).toBe('entertainment');
  });
});
