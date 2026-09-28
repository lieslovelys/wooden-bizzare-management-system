import User from '../services/userService.js';
import express from "express";
import rateLimit from 'express-rate-limit';
import { requireRole } from '../middleware/auth.js';
import { parsePagination, buildMeta, MAX_LIMIT } from '../utils/pagination.js';
import { ok } from '../utils/respond.js';
import { validate } from '../middleware/validate.js';
import { idParams } from '../schemas/common.js';
import { signupBody, workerBody, workerUpdateBody } from '../schemas/userSchemas.js';
import { AppError } from '../errors/AppError.js';

const router = express.Router();

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many login attempts, please try again later.' }
});

router.post('/signup', requireRole('Admin'), validate({ body: signupBody }), async (req, res) => {
    const b = req.body;
    // No try/catch: a failure here (duplicate username, invalid suffix, DB error) propagates to
    // the centralized error handler, which logs it server-side and returns a sanitized message —
    // it no longer echoes raw pg error fields back to the client.
    const result = await User.createUser(b.username, b.password, b.firstName, b.middleName, b.lastName, b.suffix, b.userRole);
    res.status(200).json(ok(result));
});

router.post('/login', loginLimiter, async (req, res) => {
    req.log.info({ username: req.body.username }, 'login attempt');
    // No try/catch: an invalid username/password throws an AppError(401, ...) from userService,
    // which propagates to the centralized error handler and renders identically to the old
    // inline 401 below — see userService.login for why both failure modes share one message.
    const user = await User.login(req.body.username, req.body.password);
    req.session.user = {
        user_id: user.user_id,
        username: user.username,
        user_role: user.user_role,
        first_name: user.first_name,
        middle_name: user.middle_name,
        last_name: user.last_name,
        suffix: user.suffix
    };

    req.session.save(err => {
        if (err) {
            req.log.error({ err }, 'session save failed');
            return res.status(500).json({ success: false, error: 'Failed to establish session' });
        }
        res.status(200).json(ok(null));
    });
});

router.get('/session-user', (req, res) => {
  if (!req.session.user) {
    // A synchronous throw inside a plain (non-async) handler is still caught and forwarded by
    // Express — this has been true since well before v5's async/Promise auto-forwarding.
    throw new AppError(401, 'No user in session');
  }
  res.json(ok(req.session.user));
});

// P2: was GET /logout — a state-mutating request has no business being a GET (PRD/
// ARCHITECTURE_REVIEW.md P2). No auth middleware added: the route must keep answering 200 on an
// already-destroyed/missing session (session.destroy's callback fires regardless), since
// /api/logout is deliberately not in api/client.js's AUTH_EXEMPT_PATHS — a 401 here would
// trigger the client's redirect-to-/login instead of Logout.jsx's intended page reload.
router.post('/logout', (req, res) => {

  req.session.destroy((err) => {
    if (err) {
      req.log.error({ err }, 'error destroying session');

      return res.status(500).json({ success: false, error: 'Error logging out' });
    } else {

      res.clearCookie('connect.sid');

      res.status(200).json(ok(null));

    }
  });
});

// --- BAGONG ROUTE PARA SA ACCOUNT LIST ---
const ADMIN_ONLY = requireRole('Admin');

// P1-3: capped-only (account list is headcount-bounded, no paging UI) — defaults to MAX_LIMIT
// rather than the smaller DEFAULT_LIMIT so a client that sends no ?limit= keeps seeing
// everything up to the hard cap, not a silently truncated 25-row page. See
// ARCHITECTURE_REVIEW.md P1-3.
router.get('/users', ADMIN_ONLY, async (req, res) => {
    const pagination = parsePagination(req.query, { defaultLimit: MAX_LIMIT });
    const { rows, total } = await User.getUsers(pagination);
    res.status(200).json(ok(rows, buildMeta({ ...pagination, total })));
});

router.delete('/users/:id', ADMIN_ONLY, validate({ params: idParams() }), async (req, res) => {
    await User.deleteUser(req.params.id, req.session.user.user_id);
    res.status(200).json(ok(null));
});

router.get('/workers', ADMIN_ONLY, async (req, res) => {
    const pagination = parsePagination(req.query, { defaultLimit: MAX_LIMIT });
    const { rows, total } = await User.getWorkers(pagination);
    res.status(200).json(ok(rows, buildMeta({ ...pagination, total })));
});

// PRD.md C.2 "Storage discipline": the worker list carries `photo_path` (a filename), not the
// photo itself — the frontend requests it here one at a time via
// utils/format.js's workerPhotoUrl(), rather than every list response inlining every worker's
// full image. `Cross-Origin-Resource-Policy: same-site` (not helmet's default `same-origin`)
// lets an <img> on the Vite dev server (a different origin from the API in local, non-Docker
// dev) still load it; the Docker deployment is same-origin behind Nginx either way, so this only
// relaxes the local-dev case, and only for this one route.
router.get('/workers/:id/photo', ADMIN_ONLY, validate({ params: idParams() }), async (req, res) => {
    const { fullPath, photoPath } = await User.getWorkerPhoto(req.params.id);
    res.set({
        'Cache-Control': 'private, max-age=31536000, immutable',
        'Cross-Origin-Resource-Policy': 'same-site',
        ETag: `"${photoPath}"`,
    });
    res.sendFile(fullPath);
});

router.post('/workers', ADMIN_ONLY, validate({ body: workerBody }), async (req, res) => {
    // Dinagdag natin ang middleName at suffix dito
    const { username, password, firstName, middleName, lastName, suffix, workerType, role, contactNumber, dailyRate, photo } = req.body;
    await User.addWorker(username, password, firstName, middleName, lastName, suffix, workerType, role, contactNumber, dailyRate, photo);
    res.status(200).json(ok(null));
});

router.put('/workers/:id', ADMIN_ONLY, validate({ params: idParams(), body: workerUpdateBody }), async (req, res) => {
    const { workerType, role, contactNumber, dailyRate, photo } = req.body;
    await User.updateWorker(req.params.id, workerType, role, contactNumber, dailyRate, photo);
    res.status(200).json(ok(null));
});

export default router;
