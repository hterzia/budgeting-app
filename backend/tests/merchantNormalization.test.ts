import { describe, expect, it } from 'vitest';
import {
  normalizeMerchant,
  type MerchantNormalizationConfig,
} from '../src/services/merchantNormalization.js';

const baseConfig: MerchantNormalizationConfig = {
  replacements: [
    { id: 1, fromText: 'AMZN', toText: 'AMAZON', isRegex: false },
    { id: 2, fromText: '\\*[^ ]+$', toText: '', isRegex: true },
  ],
  noiseTokens: [
    { id: 1, token: 'POS', tokenType: 'word', position: 'prefix' },
    { id: 2, token: 'WEB', tokenType: 'word', position: 'any' },
    { id: 3, token: 'ID:', tokenType: 'regex', position: 'any' },
    { id: 4, token: '\\d{5,}', tokenType: 'regex', position: 'any' },
  ],
  canonicalRules: [
    { id: 1, ruleType: 'contains', pattern: 'starbucks', canonicalMerchant: 'Starbucks' },
    { id: 2, ruleType: 'regex', pattern: 'amazon', canonicalMerchant: 'Amazon' },
    { id: 3, ruleType: 'contains', pattern: 'rocket mortgage', canonicalMerchant: 'Rocket Mortgage' },
  ],
};

describe('normalizeMerchant', () => {
  it('applies replacement and canonical regex mapping', () => {
    const normalized = normalizeMerchant('AMZN Mktp US*AB123', '', baseConfig);
    expect(normalized).toBe('Amazon');
  });

  it('removes prefix/suffix noise tokens before matching', () => {
    const normalized = normalizeMerchant(
      'POS STARBUCKS WEB ID: 0000123456',
      '',
      baseConfig
    );
    expect(normalized).toBe('Starbucks');
  });

  it('uses exact canonical rule after cleanup', () => {
    const normalized = normalizeMerchant(
      'ROCKET MORTGAGE LOAN 1234567 WEB',
      '',
      baseConfig
    );
    expect(normalized).toBe('Rocket Mortgage');
  });

  it('falls back to cleaned merchant text when no canonical rule matches', () => {
    const normalized = normalizeMerchant('JCPENNEY 1623', '', baseConfig);
    expect(normalized).toBe('JCPENNEY 1623');
  });

  it('falls back to description when merchant is empty', () => {
    const normalized = normalizeMerchant('', 'Zelle payment from JANE SMITH', baseConfig);
    expect(normalized).toBe('Zelle payment from JANE SMITH');
  });

  it('returns unknown when both merchant and description are empty', () => {
    expect(normalizeMerchant('', '', baseConfig)).toBe('unknown');
  });
});
