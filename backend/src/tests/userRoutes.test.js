import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/errorHandler.js';

// Item 40: POST /api/signup was renamed to POST /api/users (Admin-only, non-Worker roles only) —
// see routes/userRoutes.js and schemas/userSchemas.js's accountBody. routeAuthorization.test.js
// already covers the 401/403 matrix with userService fully mocked; this file is the complement —
// does the real route accept a good body, reject a bad one, and is the old path really gone.
vi.mock('../services/userService.js', () => ({
  default: {
    createUser: vi.fn(),
  },
}));

const User = (await import('../services/userService.js')).default;
const userRoutes = (await import('../routes/userRoutes.js')).default;

function buildApp(user) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.session = user ? { user } : {};
    next();
  });
  app.use('/api', userRoutes);
  app.use(errorHandler);
  return app;
}

const ADMIN = { user_id: 1, user_role: 'Admin' };

const VALID_BODY = {
  username: 'new.pm',
  password: 'a-real-password',
  firstName: 'Juana',
  middleName: '',
  lastName: 'Dela Cruz',
  suffix: 'None',
  userRole: 'Production Manager',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/users', () => {
  it('creates a non-Worker account and returns 201', async () => {
    User.createUser.mockResolvedValue([{ user_id: 7 }]);
    const app = buildApp(ADMIN);

    const res = await request(app).post('/api/users').send(VALID_BODY);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(User.createUser).toHaveBeenCalledWith(
      VALID_BODY.username,
      VALID_BODY.password,
      VALID_BODY.firstName,
      VALID_BODY.middleName,
      VALID_BODY.lastName,
      VALID_BODY.suffix,
      VALID_BODY.userRole
    );
  });

  it('rejects userRole: "Worker" — Workers are created via POST /api/workers instead', async () => {
    const app = buildApp(ADMIN);

    const res = await request(app).post('/api/users').send({ ...VALID_BODY, userRole: 'Worker' });

    expect(res.status).toBe(400);
    expect(User.createUser).not.toHaveBeenCalled();
  });

  it('rejects a password under 8 characters', async () => {
    const app = buildApp(ADMIN);

    const res = await request(app).post('/api/users').send({ ...VALID_BODY, password: 'short' });

    expect(res.status).toBe(400);
    expect(User.createUser).not.toHaveBeenCalled();
  });

  it('no longer answers on the old POST /api/signup path', async () => {
    const app = buildApp(ADMIN);

    const res = await request(app).post('/api/signup').send(VALID_BODY);

    expect(res.status).toBe(404);
    expect(User.createUser).not.toHaveBeenCalled();
  });
});
