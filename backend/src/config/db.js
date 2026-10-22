import pg from 'pg';
import fs from 'fs';
import dotenv from 'dotenv';
import { logger } from './logger.js';

dotenv.config();

const { Pool } = pg;

const isLocalHost = process.env.SQL_HOST === 'localhost' || process.env.SQL_HOST === '127.0.0.1';
// Item 42: the Docker Compose deployment reaches Postgres over the compose network's own
// private bridge, as `db` (docker-compose.yml's hardcoded SQL_HOST for the backend service) —
// not a public hostname, and not "localhost" either, so it used to fall into the `ssl: {
// rejectUnauthorized: true }` branch below despite the stock `postgres:17-alpine` image never
// having TLS configured at all, failing every connection with "the server does not support SSL
// connections". Caught by CI's new compose smoke test (item 42) actually running the stack for
// the first time, rather than only building the images. `SQL_SSL=false` opts a host out of TLS
// explicitly — same trust boundary as `isLocalHost`, just one hop out: traffic between two
// containers on the same Docker-created bridge network never leaves the VPS, so there's no
// network path for the MITM scenario P1-2's cert verification defends against. Unset (the local
// non-Docker dev and any other real deployment's default) falls back to the existing
// `isLocalHost` heuristic — this never weakens verification for an actual public/managed
// Postgres host, which still needs to set nothing to get the secure default.
const sslDisabled = isLocalHost || process.env.SQL_SSL === 'false';

const pool = new Pool({
  user: process.env.SQL_USER,
  host: process.env.SQL_HOST,
  database: process.env.SQL_DB,
  password: process.env.SQL_PASS,
  port: process.env.SQL_PORT,

  // Kung local (localhost / 127.0.0.1) o SQL_SSL=false, i-disable ang SSL.
  // Kung live/Neon, gagamitin nito ang { rejectUnauthorized: false }
  // P1-2: certificate verification is on by default for any other host — `rejectUnauthorized:
  // false` accepted any certificate at all, which is a MITM exposure on the DB connection.
  // Supply a private CA via SQL_CA_CERT (a file path) if the target Postgres uses one; a
  // public-CA-signed host (e.g. most managed Postgres providers) needs nothing extra.
  ssl: sslDisabled
    ? false
    : {
        rejectUnauthorized: true,
        ca: process.env.SQL_CA_CERT ? fs.readFileSync(process.env.SQL_CA_CERT, 'utf8') : undefined,
      },

  // P1-2: sized for a single app container sharing 4 GB of RAM with Postgres and Caddy on the
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
