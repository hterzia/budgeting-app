import type { Database } from 'better-sqlite3';

export type NormalizationRuleType = 'exact' | 'contains' | 'regex';
export type NoiseTokenType = 'word' | 'regex';
export type NoiseTokenPosition = 'any' | 'prefix' | 'suffix';

interface ReplacementRule {
  id: number;
  fromText: string;
  toText: string;
  isRegex: boolean;
}

interface NoiseTokenRule {
  id: number;
  token: string;
  tokenType: NoiseTokenType;
  position: NoiseTokenPosition;
}

interface CanonicalRule {
  id: number;
  ruleType: NormalizationRuleType;
  pattern: string;
  canonicalMerchant: string;
}

export interface MerchantNormalizationConfig {
  replacements: ReplacementRule[];
  noiseTokens: NoiseTokenRule[];
  canonicalRules: CanonicalRule[];
}

const EMPTY_CONFIG: MerchantNormalizationConfig = {
  replacements: [],
  noiseTokens: [],
  canonicalRules: [],
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeForMatch(value: string): string {
  return normalizeWhitespace(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function sanitizeDisplay(value: string): string {
  return normalizeWhitespace(
    value
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
  );
}

function applyReplacementRule(input: string, rule: ReplacementRule): string {
  if (!rule.fromText) return input;

  if (rule.isRegex) {
    try {
      const regex = new RegExp(rule.fromText, 'gi');
      return input.replace(regex, rule.toText);
    } catch {
      return input;
    }
  }

  const escaped = escapeRegex(rule.fromText);
  const regex = new RegExp(escaped, 'gi');
  return input.replace(regex, rule.toText);
}

function applyNoiseRule(input: string, rule: NoiseTokenRule): string {
  if (!rule.token) return input;

  if (rule.tokenType === 'regex') {
    try {
      const regex = new RegExp(rule.token, 'gi');
      return input.replace(regex, ' ');
    } catch {
      return input;
    }
  }

  const token = escapeRegex(rule.token);

  if (rule.position === 'prefix') {
    return input.replace(new RegExp(`^\\s*${token}\\b`, 'i'), ' ');
  }

  if (rule.position === 'suffix') {
    return input.replace(new RegExp(`\\b${token}\\s*$`, 'i'), ' ');
  }

  return input.replace(new RegExp(`\\b${token}\\b`, 'gi'), ' ');
}

function matchesCanonicalRule(candidate: string, original: string, rule: CanonicalRule): boolean {
  const pattern = normalizeForMatch(rule.pattern);

  if (!pattern) return false;

  if (rule.ruleType === 'exact') {
    return candidate === pattern;
  }

  if (rule.ruleType === 'contains') {
    return candidate.includes(pattern);
  }

  try {
    const regex = new RegExp(rule.pattern, 'i');
    return regex.test(candidate) || regex.test(original);
  } catch {
    return false;
  }
}

export function normalizeMerchant(
  rawMerchant: string | undefined,
  rawDescription: string | undefined,
  config: MerchantNormalizationConfig = EMPTY_CONFIG
): string {
  const source = normalizeWhitespace(rawMerchant || rawDescription || '');
  if (!source) return 'unknown';

  let working = source;

  for (const replacement of config.replacements) {
    working = applyReplacementRule(working, replacement);
  }

  for (const noiseToken of config.noiseTokens) {
    working = applyNoiseRule(working, noiseToken);
  }

  const cleanedDisplay = sanitizeDisplay(working);
  const cleanedMatch = normalizeForMatch(cleanedDisplay);

  for (const canonicalRule of config.canonicalRules) {
    if (matchesCanonicalRule(cleanedMatch, source, canonicalRule)) {
      const canonical = normalizeWhitespace(canonicalRule.canonicalMerchant);
      if (canonical) return canonical;
    }
  }

  return cleanedDisplay || 'unknown';
}

export function loadMerchantNormalizationConfig(
  db: Database,
  userId: string
): MerchantNormalizationConfig {
  try {
    const replacementsStmt = db.prepare(
      `SELECT id, from_text, to_text, is_regex
       FROM merchant_normalization_replacements
       WHERE enabled = 1
         AND (user_id IS NULL OR user_id = ?)
       ORDER BY priority ASC,
                CASE WHEN user_id = ? THEN 0 ELSE 1 END,
                id ASC`
    );
    const replacementsResult = replacementsStmt.all(userId, userId);

    const noiseStmt = db.prepare(
      `SELECT id, token, token_type, position
       FROM merchant_noise_tokens
       WHERE enabled = 1
         AND (user_id IS NULL OR user_id = ?)
       ORDER BY priority ASC,
                CASE WHEN user_id = ? THEN 0 ELSE 1 END,
                id ASC`
    );
    const noiseResult = noiseStmt.all(userId, userId);

    const rulesStmt = db.prepare(
      `SELECT id, rule_type, pattern, canonical_merchant
       FROM merchant_normalization_rules
       WHERE enabled = 1
         AND (user_id IS NULL OR user_id = ?)
       ORDER BY priority ASC,
                CASE WHEN user_id = ? THEN 0 ELSE 1 END,
                id ASC`
    );
    const rulesResult = rulesStmt.all(userId, userId);

    return {
      replacements: replacementsResult.map((r: any) => ({
        id: r.id,
        fromText: r.from_text,
        toText: r.to_text,
        isRegex: r.is_regex,
      })),
      noiseTokens: noiseResult.map((r: any) => ({
        id: r.id,
        token: r.token,
        tokenType: r.token_type,
        position: r.position,
      })),
      canonicalRules: rulesResult.map((r: any) => ({
        id: r.id,
        ruleType: r.rule_type,
        pattern: r.pattern,
        canonicalMerchant: r.canonical_merchant,
      })),
    };
  } catch (error: any) {
    if (error?.code === 'SQLITE_ERROR' && error.message.includes('no such table')) {
      console.warn('[merchant-normalization] Tables missing, using empty normalization config');
      return EMPTY_CONFIG;
    }
    throw error;
  }
}
