import express from "express";
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';

import { pool } from './config/db.js';

dotenv.config();
const app = express();

// Fail fast rather than silently signing session cookies with a known, committed default —
// see CLAUDE.md / ARCHITECTURE_REVIEW.md P0-4.
if (!process.env.SECRET_KEY) {
    console.error('FATAL: SECRET_KEY environment variable is required.');
    process.exit(1);
}

// P1-8: the session config below already sets `proxy: true`, but without `trust proxy` the
// `secure` cookie flag behaves unpredictably behind a reverse proxy (Nginx, in the planned
// Docker Compose deployment) — Express won't know the original request was HTTPS.
app.set('trust proxy', 1);

// P1-8: replaces the hand-rolled CSP that used to live here. `script-src 'unsafe-eval'` is
// dropped outright — nothing in this app needs it. `style-src 'unsafe-inline'` is kept
// deliberately, not by oversight: the frontend uses inline `style={{...}}` throughout and
// injects at least one literal `<style>` block (admin/Profit.jsx), so removing it breaks real
// screens. Removing that dependency is a frontend refactor tracked separately (P2).
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            connectSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com'],
            imgSrc: ["'self'", 'data:', 'https:'],
            scriptSrc: ["'self'", 'https://cdnjs.cloudflare.com'],
        },
    },
}));

// Middlewares
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:5173'];
app.use(cors({
    // DINAGDAG NATIN YUNG RENDER LINK MO DITO PARA SAFE
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// P1-8: list endpoints currently return whole tables of JSON (pagination is a separate, larger
// pass — P1-3) — this is where the bandwidth actually is today.
app.use(compression());

// P1-8: method/path/status only, via morgan's standard formats — never request bodies, per the
// CLAUDE.md logging rule.
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// JSON Limit para sa profile picture
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Session
// P1-1: backed by a Postgres-resident session table (via connect-pg-simple) instead of the
// default in-memory MemoryStore, reusing the same pool config/db.js already exports. Consequences
// of the old default: every deploy/restart logged everyone out, and memory grew unbounded with
// no session GC. Cookie settings/maxAge/resave/saveUninitialized are unchanged — this changes
// only where sessions live, not how they behave.
const PgSession = connectPgSimple(session);
app.use(session({
    store: new PgSession({ pool, tableName: 'session', createTableIfMissing: false }),
    secret: process.env.SECRET_KEY,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
        // P1-10: deliberately NOT tied to NODE_ENV. The compose deployment sets
        // NODE_ENV=production (for morgan's log format and general production behavior) while
        // running HTTP-only in the interim, before a domain/TLS exists — a `secure` cookie is
        // never sent by the browser over plain HTTP, so coupling this to NODE_ENV would have
        // silently broken every login the moment that image shipped. COOKIE_SECURE defaults to
        // false and should only be flipped to 'true' once TLS terminates in front of this app.
        secure: process.env.COOKIE_SECURE === 'true',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60
    }
}));

// P1-8: liveness/readiness endpoints for the container healthchecks the planned Docker Compose
// deployment (P1-10) will consume. Mounted before the static/catch-all handlers below, or the
// SPA catch-all would swallow them. Public — no auth needed to ask "are you up".
app.get('/healthz', (req, res) => {
    res.status(200).json({ status: 'ok' });
});
app.get('/readyz', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.status(200).json({ status: 'ready' });
    } catch (error) {
        console.error('[readyz] database check failed:', error.message);
        res.status(503).json({ status: 'not ready' });
    }
});

// Import Routers
import userRoutes from './routes/userRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import jobOrderRoutes from './routes/jobOrderRoutes.js';
import adminNotifRoutes from './routes/adminNotifRoutes.js';
import adminDashboardRoutes from './routes/adminDashboardRoutes.js';
import profitRoutes from './routes/profitRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import productivityRoutes from './routes/productivityRoutes.js';

// API Routes (Dapat nauuna ang mga ito kaysa sa React static files)
// P1-10: moved from '/' to '/api' so every backend route lives under one namespace — the
// Nginx reverse proxy introduced in this pass only needs a single `/api/` rule instead of a
// growing list of root-level exceptions (login/signup/session-user/logout/users/workers).
app.use('/api', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api', jobOrderRoutes);
app.use('/api/productivity', productivityRoutes);
app.use('/api/notifications', adminNotifRoutes);
app.use('/api/dashboard', adminDashboardRoutes);
app.use('/api/profit', profitRoutes);
app.use('/api/attendance', attendanceRoutes);

// (Removed: a dead, unguarded duplicate `GET /api/workers` registration used to live here.
// It was already unreachable — jobOrderRoutes.js's own `/workers` route, mounted above via
// `app.use('/api', jobOrderRoutes)`, always matched first — but an unguarded route sitting
// one mount-order change away from going live was worth deleting outright rather than leaving.)

// P1-10: this used to also serve the built frontend from backend/src/dist and catch-all
// fallback to index.html for client-side routing — a directory that never existed in this
// repo, so every non-API GET 500'd (see ARCHITECTURE_REVIEW.md P1-10). Removed rather than
// fixed: the Docker Compose deployment's Nginx container now owns both jobs (frontend/
// nginx.conf's `location /` does the SPA fallback), and local dev never needed this either —
// `npm run dev` in frontend/ serves the app via Vite's own dev server. This process is API-only
// now; an unmatched GET correctly falls through to Express's default 404.

// Must be the LAST middleware mounted — catches anything thrown/rejected in any route above
// (including async rejections, which Express 5 forwards here automatically) and returns a
// sanitized response instead of a raw error object or stack trace.
import { errorHandler } from './middleware/errorHandler.js';
app.use(errorHandler);

const port = process.env.PORT || 8080;
const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

// P1-8: without this, every container restart/redeploy (expected to be routine under the
// planned Docker Compose setup, P1-10) severs in-flight requests instead of finishing them.
// Stop accepting new connections, let existing ones drain, close the pool, then exit — with a
// forced-exit fallback in case something hangs.
function shutdown(signal) {
    console.log(`[shutdown] received ${signal}, closing server...`);
    server.close(async () => {
        try {
            await pool.end();
            console.log('[shutdown] pool closed, exiting.');
            process.exit(0);
        } catch (error) {
            console.error('[shutdown] error while closing pool:', error.message);
            process.exit(1);
        }
    });
    setTimeout(() => {
        console.error('[shutdown] forced exit after timeout.');
        process.exit(1);
    }, 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
