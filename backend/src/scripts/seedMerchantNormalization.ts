import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { createPool } from '../db/config.js';

interface MerchantRow {
  merchant_raw?: string;
  count?: string;
}

interface TokenStats {
  weightedCount: number;
  distinctRows: number;
}

const SAFE_NOISE_WORDS = new Set([
  'POS',
  'DEBIT',
  'CREDIT',
  'PURCHASE',
  'CARD',
  'CHECKCARD',
  'ACH',
  'WEB',
  'ID',
  'PMT',
  'PAYMENT',
  'TRANSFER',
  'TRNSFR',
  'AUTH',
  'RECURRING',
  'ONLINE',
  'WITHDRAWAL',
]);

function getArgValue(args: string[], key: string): string | null {
  const idx = args.findIndex((arg) => arg === key);
  if (idx === -1) return null;
  return args[idx + 1] ?? null;
}

function parseCount(value: string | undefined): number {
  const parsed = Number.parseInt(value || '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function tokenize(raw: string): string[] {
  return raw
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

async function main() {
  const args = process.argv.slice(2);
  const fileArg = getArgValue(args, '--file');
  const userId = getArgValue(args, '--user-id');
  const apply = args.includes('--apply');

  const filePath = fileArg
    ? path.resolve(process.cwd(), fileArg)
    : path.resolve(process.cwd(), 'data/merchant_samples.csv');

  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV file not found at ${filePath}`);
  }

  const csv = fs.readFileSync(filePath, 'utf-8');
  const parsed = Papa.parse<MerchantRow>(csv, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    throw new Error(`CSV parse failed: ${parsed.errors[0].message}`);
  }

  const rows = parsed.data
    .map((row) => ({
      merchantRaw: (row.merchant_raw || '').trim(),
      count: parseCount(row.count),
    }))
    .filter((row) => row.merchantRaw.length > 0);

  if (rows.length === 0) {
    throw new Error('No merchant rows found in CSV');
  }

  const tokenMap = new Map<string, TokenStats>();
  let totalWeightedRows = 0;

  for (const row of rows) {
    totalWeightedRows += row.count;
    const seen = new Set<string>();

    for (const token of tokenize(row.merchantRaw)) {
      const stat = tokenMap.get(token) ?? { weightedCount: 0, distinctRows: 0 };
      stat.weightedCount += row.count;
      if (!seen.has(token)) {
        stat.distinctRows += 1;
        seen.add(token);
      }
      tokenMap.set(token, stat);
    }
  }

  const sortedTokens = [...tokenMap.entries()]
    .sort((a, b) => b[1].weightedCount - a[1].weightedCount)
    .slice(0, 60);

  console.log(`Analyzed ${rows.length} merchant strings (${totalWeightedRows} weighted rows)`);
  console.log('Top tokens:');
  for (const [token, stats] of sortedTokens.slice(0, 25)) {
    console.log(
      `  ${token.padEnd(16)} weighted=${String(stats.weightedCount).padEnd(8)} distinct=${stats.distinctRows}`
    );
  }

  const suggestedNoiseWords = sortedTokens
    .filter(([token, stats]) => SAFE_NOISE_WORDS.has(token) && stats.distinctRows >= 3)
    .map(([token]) => token);

  console.log('\nSuggested noise words (safe auto-seed):');
  if (suggestedNoiseWords.length === 0) {
    console.log('  none');
  } else {
    console.log(`  ${suggestedNoiseWords.join(', ')}`);
  }

  if (!apply) {
    console.log('\nDry run only. Re-run with --apply to insert suggested rows.');
    return;
  }

  const pool = createPool();
  try {
    for (const token of suggestedNoiseWords) {
      await pool.query(
        `INSERT INTO merchant_noise_tokens (user_id, token, token_type, position, priority, enabled)
         VALUES ($1, $2, 'word', 'any', 100, true)
         ON CONFLICT DO NOTHING`,
        [userId, token]
      );
    }

    // Baseline regex noise rules for long numeric references and explicit ID fragments.
    await pool.query(
      `INSERT INTO merchant_noise_tokens (user_id, token, token_type, position, priority, enabled)
       VALUES
         ($1, '\\d{5,}', 'regex', 'any', 90, true),
         ($1, 'ID[: ]*\\d+', 'regex', 'any', 90, true)
       ON CONFLICT DO NOTHING`,
      [userId]
    );

    console.log(`Inserted ${suggestedNoiseWords.length} word tokens + 2 regex tokens into merchant_noise_tokens`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('[seed-merchant-normalization] failed:', error.message);
  process.exit(1);
});
