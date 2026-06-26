import express from "express";
import cors from "cors";
import helmet from "helmet";
import { getDb, closeDb } from "./db/sqlite.js";
import { logger } from "./utils/logging.js";
import {
  createImportRouter,
  createTransactionRouter,
} from "./routes/importsSqlite.js";
import {
  createAccountsRouter,
  createCategoriesRouter,
  createListTransactionsRouter,
} from "./routes/dataSqlite.js";
import { migrateUp } from "./db/migrateSqlite.js";
import { initEmbeddingModel } from "./services/localEmbeddings.js";

const app = express();
const PORT = Number(process.env['PORT'] || 3001);
const BIND_HOST = process.env['BIND_HOST'] || "0.0.0.0";

// Middleware
app.use(cors());
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", "http://localhost:*"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

export async function startServer(): Promise<number> {
  // Create database connection
  const db = getDb();

  // Run migrations
  await migrateUp();

  // Start loading the embedding model in the background (non-blocking)
  initEmbeddingModel().catch((err: any) => {
    console.warn('Embedding model failed to load:', err.message);
    console.warn('KNN categorization will be unavailable until model loads');
  });

  // Routes
  const importRouter = createImportRouter(db);
  const transactionRouter = createTransactionRouter(db);
  const listTransactionsRouter = createListTransactionsRouter(db);

  app.use("/imports", importRouter);
  // Mount list + toggle-ignore before the category-update router so GET / and /:id/toggle-ignore resolve correctly
  app.use("/transactions", listTransactionsRouter);
  app.use("/transactions", transactionRouter);
  app.use("/accounts", createAccountsRouter(db));
  app.use("/categories", createCategoriesRouter(db));

  // Try the configured port, then fallback to random ports if occupied
  return new Promise((resolve, reject) => {
    const server = app.listen(PORT, BIND_HOST, () => {
      const addr = server.address();
      const actualPort = typeof addr === 'object' && addr ? addr.port : PORT;
      logger.info("Budgeting backend listening on %s:%d", BIND_HOST, actualPort);
      resolve(actualPort);
    });
    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        logger.warn("Port %d in use, trying random port...", PORT);
        const fallback = app.listen(0, BIND_HOST, () => {
          const addr = fallback.address();
          const actualPort = typeof addr === 'object' && addr ? addr.port : 0;
          logger.info("Budgeting backend listening on %s:%d", BIND_HOST, actualPort);
          resolve(actualPort);
        });
        fallback.on('error', reject);
      } else {
        reject(err);
      }
    });
  });
}

// Auto-start when run directly (not imported by Electron)
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const isDirectRun = process.argv[1] === __filename
  || process.argv[1]?.endsWith('server.js')
  || process.argv[1]?.endsWith('server.ts');
if (isDirectRun) {
  process.on('SIGTERM', () => closeDb());
  process.on('SIGINT', () => closeDb());
  startServer().catch((error: any) => {
    logger.error("Failed to start server: %s", error.message);
    process.exit(1);
  });
}

export default app;
