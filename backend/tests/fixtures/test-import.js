import 'dotenv/config';
import { createPool } from './src/db/config.js';
import { createImportRouter } from './src/routes/imports.js';
import Papa from 'papaparse';

const pool = createPool();

async function testImport() {
  const router = createImportRouter(pool);

  // Create a mock request/response
  const req = {
    body: {
      userId: 'test-user-001',
      file: 'date,description,amount,type\n2026-03-01,Netflix Subscription,-15.99,expense\n2026-03-02,Salary Deposit,5000.00,income'
    }
  };

  const res = {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.data = data;
      console.log('Response:', JSON.stringify(data, null, 2));
    }
  };

  try {
    await router.stack[0].handle(req, res);
  } catch (error) {
    console.error('Error:', error);
  }

  // Verify data was inserted
  console.log('\nVerifying data in database...');
  const result = await pool.query('SELECT id, user_id, merchant_clean FROM transactions ORDER BY id DESC LIMIT 5');
  console.log('Transactions:', result.rows);

  pool.end();
}

testImport().catch(console.error);
