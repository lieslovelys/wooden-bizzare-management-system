// Thin wrapper around node-pg-migrate's programmatic runner.
//
// node-pg-migrate's CLI wants a DATABASE_URL, but this app already has a full connection
// contract (SQL_USER/SQL_HOST/SQL_DB/SQL_PASS/SQL_PORT — see config/db.js). Introducing a
// second, differently-spelled way to configure the same connection is exactly the kind of
// drift this tooling exists to prevent, so this script builds the same `databaseUrl` client
// config object config/db.js would, and hands that to the runner directly.
//
// Usage (from backend/src): `npm run migrate` (up) or `npm run migrate:down` (down one step).
//
// Deliberately plain console.log/console.error, not config/logger.js's structured pino logger:
// this is a one-shot CLI tool a human operator runs and reads directly (also true of
// createAdmin.js and backfillPhotos.js) — `verbose: true` above already makes node-pg-migrate
// itself print plain, human-readable progress, and JSON log lines would be strictly harder to
// read next to that, for no aggregation/correlation benefit a script run by hand ever needs.
import { runner } from 'node-pg-migrate';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const direction = process.argv[2] === 'down' ? 'down' : 'up';

// Same SSL policy as config/db.js (see P1-2): verify certificates by default, allow a private
// CA via SQL_CA_CERT, skip TLS entirely for a local dev database.
const isLocal = process.env.SQL_HOST === 'localhost' || process.env.SQL_HOST === '127.0.0.1';

const clientConfig = {
  user: process.env.SQL_USER,
  host: process.env.SQL_HOST,
  database: process.env.SQL_DB,
  password: process.env.SQL_PASS,
  port: process.env.SQL_PORT,
  ssl: isLocal
    ? false
    : {
        rejectUnauthorized: true,
        ca: process.env.SQL_CA_CERT ? fs.readFileSync(process.env.SQL_CA_CERT, 'utf8') : undefined,
      },
};

async function main() {
  try {
    await runner({
      databaseUrl: clientConfig,
      dir: path.join(__dirname, '..', 'migrations'),
      migrationsTable: 'pgmigrations',
      direction,
      count: direction === 'down' ? 1 : Infinity,
      verbose: true,
    });
    console.log(`Migrations (${direction}) complete.`);
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

main();
