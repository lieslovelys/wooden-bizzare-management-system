import User from '../services/userService.js';
import express from "express";
import rateLimit from 'express-rate-limit';
import { requireRole } from '../middleware/auth.js';
import { parsePagination, buildMeta, MAX_LIMIT } from '../utils/pagination.js';
import { validate } from '../middleware/validate.js';
import { idParams } from '../schemas/common.js';
import { signupBody, workerBody, workerUpdateBody } from '../schemas/userSchemas.js';

const router = express.Router();

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts, please try again later.' }
});

router.post('/signup', requireRole('Admin'), validate({ body: signupBody }), async (req, res) => {
    const b = req.body;
    // No try/catch: a failure here (duplicate username, invalid suffix, DB error) propagates to
    // the centralized error handler, which logs it server-side and returns a sanitized message —
    // it no longer echoes raw pg error fields back to the client.
    const result = await User.createUser(b.username, b.password, b.firstName, b.middleName, b.lastName, b.suffix, b.userRole);
    res.status(200).send({ message: 'Successfully created user', body: result });
});

router.post('/login', loginLimiter, async (req, res) => {
    console.log('login attempt:', req.body.username);
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
            console.error('Session save failed:', err.message);
            return res.status(500).json({ error: 'Failed to establish session' });
        }
        res.status(200).send({ err: false, message: 'Login Successful' });
    });
});

router.get('/session-user', (req, res) => {
  if (req.session.user) {
    res.json(req.session.user);
  } else {
    res.status(401).json({ 
      error: "No user in session", 
      id: req.sessionID 
    });
  }
});

router.get('/logout', (req, res) => {

  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
   
      return res.status(500).send({message: 'Error logging out'});
    } else {

      res.clearCookie('connect.sid'); 

      
      res.status(200).send({message: 'Successfully logged out'});

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
    res.status(200).json({ success: true, data: rows, meta: buildMeta({ ...pagination, total }) });
});

router.delete('/users/:id', ADMIN_ONLY, validate({ params: idParams() }), async (req, res) => {
    await User.deleteUser(req.params.id, req.session.user.user_id);
    res.status(200).json({ success: true, message: 'User deleted successfully' });
});

router.get('/workers', ADMIN_ONLY, async (req, res) => {
    const pagination = parsePagination(req.query, { defaultLimit: MAX_LIMIT });
    const { rows, total } = await User.getWorkers(pagination);
    res.status(200).json({ success: true, data: rows, meta: buildMeta({ ...pagination, total }) });
});

router.post('/workers', ADMIN_ONLY, validate({ body: workerBody }), async (req, res) => {
    // Dinagdag natin ang middleName at suffix dito
    const { username, password, firstName, middleName, lastName, suffix, workerType, role, contactNumber, dailyRate, photo } = req.body;
    await User.addWorker(username, password, firstName, middleName, lastName, suffix, workerType, role, contactNumber, dailyRate, photo);
    res.status(200).json({ success: true, message: 'Worker added successfully' });
});

router.put('/workers/:id', ADMIN_ONLY, validate({ params: idParams(), body: workerUpdateBody }), async (req, res) => {
    const { workerType, role, contactNumber, dailyRate, photo } = req.body;
    await User.updateWorker(req.params.id, workerType, role, contactNumber, dailyRate, photo);
    res.status(200).json({ success: true, message: 'Worker details updated successfully' });
});

export default router;