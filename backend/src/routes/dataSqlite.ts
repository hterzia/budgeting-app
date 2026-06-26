import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { Database } from 'better-sqlite3';

const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000000';

function mapTransaction(row: any) {
  const isIgnored = row.type === 'ignored';
  return {
    id: String(row.id),
    date: row.posted_at,
    merchant: row.merchant_clean || row.merchant_raw || '',
    amount: row.amount_cents / 100,
    type: row.type,
    categoryId: row.category_id || 'uncategorized',
    accountId: row.account_id || '',
    importedAt: row.created_at,
    createdAt: row.created_at,
    isIgnored: isIgnored,
    originalType: row.original_type,
  };
}

function mapAccount(row: any) {
  return {
    id: String(row.id),
    name: row.name,
    type: row.type,
  };
}

function mapCategory(row: any) {
  return {
    id: row.id,
    slug: row.id, // slug is the category ID (e.g. 'groceries', 'dining')
    name: row.name,
    type: row.type,
    color: row.color,
    ...(row.icon ? { icon: row.icon } : {}),
  };
}

export function createAccountsRouter(db: Database): Router {
  const router = Router();

  // GET /accounts
  router.get('/', (req: Request, res: Response): any => {
    try {
      const stmt = db.prepare(
        `SELECT * FROM accounts WHERE user_id = ? ORDER BY created_at ASC`
      );
      res.json(stmt.all(DEFAULT_USER_ID).map(mapAccount));
    } catch (error: any) {
      console.error('[data] Error fetching accounts:', error.message);
      res.status(500).json({ error: 'Failed to fetch accounts' });
    }
  });

  // POST /accounts
  router.post('/', (req: Request, res: Response): any => {
    try {
      const { name, type } = req.body;
      if (!name || !type) {
        return res.status(400).json({ error: 'Missing name or type' });
      }
      const id = uuidv4();
      const stmt = db.prepare(
        `INSERT INTO accounts (id, user_id, name, type) VALUES (?, ?, ?, ?)`
      );
      stmt.run(id, DEFAULT_USER_ID, name, type);
      const inserted = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
      res.status(201).json(mapAccount(inserted));
    } catch (error: any) {
      console.error('[data] Error creating account:', error.message);
      res.status(500).json({ error: 'Failed to create account' });
    }
  });

  // PUT /accounts/:id
  router.put('/:id', (req: Request, res: Response): any => {
    try {
      const { id } = req.params;
      const { name, type } = req.body;

      const existing = db.prepare(`SELECT * FROM accounts WHERE id = ? AND user_id = ?`).get(id, DEFAULT_USER_ID);
      if (!existing) {
        return res.status(404).json({ error: 'Account not found' });
      }

      const updates: any[] = [];
      const values: any[] = [id, DEFAULT_USER_ID];
      const paramIndex = 3;

      if (name !== undefined) {
        if (!name || typeof name !== 'string' || !name.trim()) {
          return res.status(400).json({ error: 'Invalid name' });
        }
        updates.push(`name = ?`);
        values.push(name.trim());
      }
      if (type !== undefined) {
        if (type !== 'checking' && type !== 'savings' && type !== 'credit_card') {
          return res.status(400).json({ error: 'type must be "checking", "savings", or "credit_card"' });
        }
        updates.push(`type = ?`);
        values.push(type);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No updates provided' });
      }

      values.push(id);
      db.prepare(`UPDATE accounts SET ${updates.join(', ')} WHERE id = ?`).run(...values);
      const updated = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
      res.json(mapAccount(updated));
    } catch (error: any) {
      console.error('[data] Error updating account:', error.message);
      res.status(500).json({ error: 'Failed to update account' });
    }
  });

  // DELETE /accounts/:id
  router.delete('/:id', (req: Request, res: Response): any => {
    try {
      const { id } = req.params;
      const result = db.prepare(`DELETE FROM accounts WHERE id = ? AND user_id = ?`).run(id, DEFAULT_USER_ID);
      if (result.changes === 0) {
        return res.status(404).json({ error: 'Account not found' });
      }
      res.status(204).send();
    } catch (error: any) {
      console.error('[data] Error deleting account:', error.message);
      res.status(500).json({ error: 'Failed to delete account' });
    }
  });

  return router;
}

export function createCategoriesRouter(db: Database): Router {
  const router = Router();

  // GET /categories
  router.get('/', (req: Request, res: Response): any => {
    try {
      const stmt = db.prepare(
        `SELECT * FROM categories WHERE user_id = ? ORDER BY type DESC, name ASC`
      );
      res.json(stmt.all(DEFAULT_USER_ID).map(mapCategory));
    } catch (error: any) {
      console.error('[data] Error fetching categories:', error.message);
      res.status(500).json({ error: 'Failed to fetch categories' });
    }
  });

  // POST /categories
  router.post('/', (req: Request, res: Response): any => {
    try {
      const { name, type, color, icon } = req.body;

      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Missing or invalid name' });
      }
      if (type !== 'income' && type !== 'expense' && type !== 'transfer') {
        return res.status(400).json({ error: 'type must be "income", "expense", or "transfer"' });
      }
      if (!color || typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color)) {
        return res.status(400).json({ error: 'color must be a valid hex color (e.g. #22c55e)' });
      }

      const id = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      if (!id) {
        return res.status(400).json({ error: 'Name produces an invalid id' });
      }

      const stmt = db.prepare(
        `INSERT INTO categories (id, user_id, name, type, color, icon) VALUES (?, ?, ?, ?, ?, ?)`
      );
      try {
        stmt.run(id, DEFAULT_USER_ID, name.trim(), type, color, icon ?? null);
      } catch (e: any) {
        if (e.message.includes('UNIQUE constraint')) {
          return res.status(409).json({ error: 'A category with that name already exists' });
        }
        throw e;
      }

      const inserted = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
      res.status(201).json(mapCategory(inserted));
    } catch (error: any) {
      if (error.message.includes('UNIQUE constraint')) {
        return res.status(409).json({ error: 'A category with that name already exists' });
      }
      console.error('[data] Error creating category:', error.message);
      res.status(500).json({ error: 'Failed to create category' });
    }
  });

  // PUT /categories/:id
  router.put('/:id', (req: Request, res: Response): any => {
    try {
      const { id } = req.params;
      const { name, type, color, icon } = req.body;

      const existing = db.prepare(`SELECT * FROM categories WHERE id = ? AND user_id = ?`).get(id, DEFAULT_USER_ID);
      if (!existing) {
        return res.status(404).json({ error: 'Category not found' });
      }

      const updates: any[] = [];
      const values: any[] = [];
      if (name !== undefined) {
        updates.push(`name = ?`);
        values.push(name.trim());
      }
      if (type !== undefined) {
        if (type !== 'income' && type !== 'expense' && type !== 'transfer') {
          return res.status(400).json({ error: 'type must be "income", "expense", or "transfer"' });
        }
        updates.push(`type = ?`);
        values.push(type);
      }
      if (color !== undefined) {
        if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
          return res.status(400).json({ error: 'color must be a valid hex color' });
        }
        updates.push(`color = ?`);
        values.push(color);
      }
      if (icon !== undefined) {
        updates.push(`icon = ?`);
        values.push(icon ?? null);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No updates provided' });
      }

      values.push(id);
      values.push(DEFAULT_USER_ID);
      db.prepare(`UPDATE categories SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);
      const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
      res.json(mapCategory(updated));
    } catch (error: any) {
      if (error.message.includes('UNIQUE constraint')) {
        return res.status(409).json({ error: 'A category with that name already exists' });
      }
      console.error('[data] Error updating category:', error.message);
      res.status(500).json({ error: 'Failed to update category' });
    }
  });

  // DELETE /categories/:id
  router.delete('/:id', (req: Request, res: Response): any => {
    try {
      const { id } = req.params;
      const result = db.prepare(`DELETE FROM categories WHERE id = ? AND user_id = ?`).run(id, DEFAULT_USER_ID);
      if (result.changes === 0) {
        return res.status(404).json({ error: 'Category not found' });
      }
      res.status(204).send();
    } catch (error: any) {
      console.error('[data] Error deleting category:', error.message);
      res.status(500).json({ error: 'Failed to delete category' });
    }
  });

  return router;
}

export function createListTransactionsRouter(db: Database): Router {
  const router = Router();
  const MAX_PAGE_SIZE = 1000;
  const DEFAULT_PAGE_SIZE = 100;

  router.use((req: Request, res: Response, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
  });

  function isValidDate(dateStr: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return false;
    }
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
  }

  // GET /transactions
  router.get('/', (req: Request, res: Response): any => {
    try {
      let all: unknown = (req.query as any).all;
      if (Array.isArray(all)) all = all[0];

      let fetchAll = false;
      if (typeof all === 'string') {
        const normalized = all.toLowerCase();
        if (normalized === 'true' || normalized === '1') {
          fetchAll = true;
        } else if (normalized === 'false' || normalized === '0') {
          fetchAll = false;
        } else {
          return res.status(400).json({ error: 'Invalid all value (expected true/false)' });
        }
      }

      let limit = DEFAULT_PAGE_SIZE;
      let offset = 0;

      if (!fetchAll) {
        let rawLimit: unknown = (req.query as any).limit;
        if (typeof rawLimit === 'string') {
          rawLimit = parseInt(rawLimit, 10);
        } else if (Array.isArray(rawLimit)) {
          rawLimit = parseInt(rawLimit[0], 10);
        } else {
          rawLimit = DEFAULT_PAGE_SIZE;
        }
        if (typeof rawLimit !== 'number' || isNaN(rawLimit) || rawLimit < 1) {
          return res.status(400).json({ error: 'Invalid limit value' });
        }
        if (rawLimit > MAX_PAGE_SIZE) {
          rawLimit = MAX_PAGE_SIZE;
        }

        let rawOffset: unknown = (req.query as any).offset;
        if (typeof rawOffset === 'string') {
          rawOffset = parseInt(rawOffset, 10);
        } else if (Array.isArray(rawOffset)) {
          rawOffset = parseInt(rawOffset[0], 10);
        } else {
          rawOffset = 0;
        }
        if (typeof rawOffset !== 'number' || isNaN(rawOffset) || rawOffset < 0) {
          return res.status(400).json({ error: 'Invalid offset value' });
        }

        limit = rawLimit as number;
        offset = rawOffset as number;
      }

      let start: string | undefined;
      const startParam = (req.query as any).start;
      if (typeof startParam === 'string') {
        if (!isValidDate(startParam)) {
          return res.status(400).json({ error: 'Invalid start date format (expected YYYY-MM-DD)' });
        }
        start = startParam;
      }

      let end: string | undefined;
      const endParam = (req.query as any).end;
      if (typeof endParam === 'string') {
        if (!isValidDate(endParam)) {
          return res.status(400).json({ error: 'Invalid end date format (expected YYYY-MM-DD)' });
        }
        end = endParam;
      }

      let query = `
        SELECT id, user_id, import_batch_id, posted_at, amount_cents, currency,
               merchant_raw, merchant_clean, category_id, category_source,
               category_confidence, needs_review, account_id, type, original_type,
               created_at
        FROM transactions
        WHERE user_id = ?
      `;
      const params: any[] = [DEFAULT_USER_ID];

      if (start) {
        query += ` AND posted_at >= ?`;
        params.push(start);
      }
      if (end) {
        query += ` AND posted_at <= ?`;
        params.push(end);
      }

      query += ` ORDER BY posted_at DESC, id DESC`;
      if (!fetchAll) {
        query += ` LIMIT ? OFFSET ?`;
        params.push(limit, offset);
      }

      const stmt = db.prepare(query);
      res.json(stmt.all(...params).map(mapTransaction));
    } catch (error: any) {
      console.error('[data] Error fetching transactions:', error.message);
      res.status(500).json({ error: 'Failed to fetch transactions' });
    }
  });

  // POST /transactions/:id/toggle-ignore
  router.post('/:id/toggle-ignore', (req: Request, res: Response): any => {
    try {
      const { id } = req.params;

      const existingRaw = db.prepare(`SELECT id, type, original_type FROM transactions WHERE id = ? AND user_id = ?`).get(id, DEFAULT_USER_ID);
      const existing = existingRaw as { id: number; type: string; original_type: string | null };
      if (!existing) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      const tx = existing;

      if (tx.type === 'ignored') {
        const restoreType = tx.original_type || 'unknown';
        db.prepare(`UPDATE transactions SET type = ?, original_type = NULL WHERE id = ?`).run(restoreType, id);
        res.json({ id: String(id), type: restoreType, isIgnored: false });
      } else {
        db.prepare(`UPDATE transactions SET type = 'ignored', original_type = ? WHERE id = ?`).run(tx.type, id);
        res.json({ id: String(id), type: 'ignored', isIgnored: true });
      }
    } catch (error: any) {
      console.error('[data] Error toggling ignore:', error.message);
      res.status(500).json({ error: 'Failed to toggle ignore' });
    }
  });

  return router;
}
