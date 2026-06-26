#!/usr/bin/env tsx

import 'dotenv/config';
import { migrateUp, migrateDown } from './migrateSqlite.js';

// Explicitly load .env.local from project root
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const envPath = path.join(projectRoot, '.env.local');

if (fs.existsSync(envPath)) {
  const dotenv = await import('dotenv');
  dotenv.config({ path: envPath });
}

// Simple CLI for migrations
const args = process.argv.slice(2);
const command = args[0];

if (command === 'up') {
  console.log('[migration] Applying SQLite schema...');
  migrateUp()
    .then(() => {
      console.log('[migration] Schema applied successfully');
      process.exit(0);
    })
    .catch((error: any) => {
      console.error('[migration] Error:', error.message);
      process.exit(1);
    });
} else if (command === 'down') {
  console.log('[migration] Dropping SQLite schema...');
  migrateDown()
    .then(() => {
      console.log('[migration] Schema dropped successfully');
      process.exit(0);
    })
    .catch((error: any) => {
      console.error('[migration] Error:', error.message);
      process.exit(1);
    });
} else {
  console.log('Usage: tsx src/db/runMigrateSqlite.ts up|down');
  process.exit(1);
}
