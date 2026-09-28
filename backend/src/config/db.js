import pg from 'pg';
import fs from 'fs';
import dotenv from 'dotenv';
import { logger } from './logger.js';

dotenv.config();

const { Pool } = pg;

const isLocalHost = process.env.SQL_HOST === 'localhost' || process.env.SQL_HOST === '127.0.0.1';

const pool = new Pool({
  user: process.env.SQL_USER,
  host: process.env.SQL_HOST,
  database: process.env.SQL_DB,
  password: process.env.SQL_PASS,
  port: process.env.SQL_PORT,

  // Kung local (localhost / 127.0.0.1), i-disable ang SSL.
  // Kung live/Neon, gagamitin nito ang { rejectUnauthorized: false }
  // P1-2: certificate verification is now on by default for any non-localhost host —
  // `rejectUnauthorized: false` accepted any certificate at all, which is a MITM exposure on
  // the DB connection. Supply a private CA via SQL_CA_CERT (a file path) if the target
  // Postgres uses one; a public-CA-signed host (e.g. most managed Postgres providers) needs
  // nothing extra.
  ssl: isLocalHost
    ? false
    : {
        rejectUnauthorized: true,
        ca: process.env.SQL_CA_CERT ? fs.readFileSync(process.env.SQL_CA_CERT, 'utf8') : undefined,
      },

  // P1-2: sized for a single app container sharing 4 GB of RAM with Postgres and Nginx on the
  // target Hostinger KVM 1 VPS (1 vCPU) — each Postgres backend process has a real memory
  // cost, so a larger pool here is a net loss, not just unnecessary headroom. Timeouts make
  // requests fail fast under load instead of queuing indefinitely and let one slow query
  // release its connection instead of starving the whole pool.
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 10000,

  // P1-9: every pooled connection computes CURRENT_DATE/EXTRACT/timestamptz rendering against
  // the business's own timezone, regardless of what timezone the container's OS clock runs on
  // (a Hostinger VPS defaults to UTC; this business operates in Asia/Manila, UTC+8).
  options: '-c timezone=Asia/Manila',
});


const testPoolConnection = async() => {
  let client;
  try {
    client = await pool.connect();

    // Execute a test query
    const res = await client.query('SELECT 1 AS "result"');
    logger.info({ result: res.rows[0].result }, 'database connection pool: smoke test query succeeded');

    return true; // Connection successful
  }
  catch (err) {
    logger.error({ err }, 'database connection pool: smoke test failed');
    return false; // Connection failed
  }
  finally {
    if (client) {
      client.release();
    }
  }
}

testPoolConnection();

export const query = (query, params) => pool.query(query, params);
export const getClient = () => pool.connect();
// Exported so the session store (P1-1, connect-pg-simple) and graceful shutdown (P1-8) reuse
// this one pool instead of each opening their own.
export { pool };
