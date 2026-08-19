import User from '../controllers/userController.js';
import express from "express";
import rateLimit from 'express-rate-limit';
import { requireRole } from '../middleware/auth.js';

const router = express.Router();

// Must match the `user_role` Postgres enum exactly (backend/index.sql). 'Admin' is included —
// this is also the real admin account-creation screen (admin/CreateAccount.jsx), not just a
// dev endpoint, so the fix here is a server-side whitelist + admin-only auth, not blocking
// any particular role.
const ALLOWED_ROLES = ['Admin', 'Production Manager', 'Inventory Staff', 'Quality Checker', 'Worker'];

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts, please try again later.' }
});

router.post('/signup', requireRole('Admin'), async (req, res) => {
    const b = req.body;
    if (!ALLOWED_ROLES.includes(b.userRole)) {
        return res.status(400).json({ error: 'Invalid role' });
    }
    // No try/catch: a failure here (duplicate username, invalid suffix, DB error) propagates to
    // the centralized error handler, which logs it server-side and returns a sanitized message —
    // it no longer echoes raw pg error fields back to the client.
    const result = await User.createUser(b.username, b.password, b.firstName, b.middleName, b.lastName, b.suffix, b.userRole);
    res.status(200).send({ message: 'Successfully created user', body: result });
});

router.post('/login', loginLimiter, async (req, res) => {
    console.log('login attempt:', req.body.username);
    const result = await User.login(req.body.username, req.body.password);
    if (result.err !== true) {
        const user = result.user[0];
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
    } else {
        // Same status and message whether the username doesn't exist or the password was
        // wrong — see userController.login for why.
        res.status(401).json({ error: 'Invalid username or password' });
    }
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
router.get('/users', ADMIN_ONLY, User.getUsers);
router.delete('/users/:id', ADMIN_ONLY, User.deleteUser);
router.get('/workers', ADMIN_ONLY, User.getWorkers);
router.post('/workers', ADMIN_ONLY, User.addWorker);
router.put('/workers/:id', ADMIN_ONLY, User.updateWorker);

export default router;