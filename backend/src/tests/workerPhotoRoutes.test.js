import { describe, it, expect, vi, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import os from 'os';

// End-to-end coverage of GET /api/workers/:id/photo through the REAL app.js → userRoutes →
// userService → userModel → photoStorage chain (only config/db.js's `query` and the session
// layer are faked) — routeAuthorization.test.js already covers the 401/403 matrix with
// userService fully mocked, so this is the complement: does the real route actually serve bytes,
// and does it 404 correctly, rather than just gate on role.

const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

// Must happen BEFORE the dynamic `import('../app.js')` below (which pulls in userService →
// photoStorage.js) — photoStorage.js resolves UPLOAD_DIR from process.env once, at
// module-evaluation time, so setting this inside a beforeAll hook would be too late: the module
// graph is already imported at this point in file evaluation, not when hooks run.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wbms-photoroutes-'));
process.env.UPLOAD_DIR = tmpDir;
fs.writeFileSync(path.join(tmpDir, 'has-photo.jpg'), JPEG_BYTES);

afterAll(async () => {
  delete process.env.UPLOAD_DIR;
  await fsp.rm(tmpDir, { recursive: true, force: true });
});

// Rows keyed by worker (users.user_id): 1 has a real file on disk, 2 has no photo_path at all,
// 3 has a photo_path but the file was never written (simulates it being deleted out from under
// the app — a real, if rare, possibility since removePhoto/backfill both touch the same disk).
const PHOTO_PATH_BY_USER = { 1: 'has-photo.jpg', 2: null, 3: 'missing-file.jpg' };

vi.mock('../config/db.js', () => ({
  pool: { query: vi.fn(), connect: vi.fn() },
  query: vi.fn((sql, params) => {
    if (sql.includes('SELECT photo_path FROM worker_details')) {
      const userId = params[0];
      // Object keys are always strings; params[0] arrives as supertest's raw path segment
      // ("1", "404", ...), matching that without coercion.
      if (!(userId in PHOTO_PATH_BY_USER)) return Promise.resolve({ rows: [] }); // unknown worker
      return Promise.resolve({ rows: [{ photo_path: PHOTO_PATH_BY_USER[userId] }] });
    }
    return Promise.resolve({ rows: [] });
  }),
  getClient: vi.fn(),
}));

vi.mock('connect-pg-simple', () => ({
  default: () => class {},
}));

function fakeSession() {
  return (req, res, next) => {
    const raw = req.headers['x-test-user'];
    req.session = {
      user: raw ? JSON.parse(raw) : undefined,
      save: (cb) => cb && cb(),
      destroy: (cb) => cb && cb(),
    };
    next();
  };
}
vi.mock('express-session', () => ({ default: fakeSession }));

process.env.SECRET_KEY = 'test-secret';
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'log').mockImplementation(() => {});

const { app } = await import('../app.js');

const ADMIN = JSON.stringify({ user_id: 99, user_role: 'Admin' });

describe('GET /api/workers/:id/photo', () => {
  it('serves the real file with caching/CORP headers', async () => {
    const res = await request(app)
      .get('/api/workers/1/photo')
      .set('x-test-user', ADMIN);

    expect(res.status).toBe(200);
    expect(Buffer.compare(res.body, JPEG_BYTES)).toBe(0);
    expect(res.headers['content-type']).toMatch(/image\/jpeg/);
    expect(res.headers['cache-control']).toBe('private, max-age=31536000, immutable');
    expect(res.headers['cross-origin-resource-policy']).toBe('same-site');
  });

  it('404s when the worker has no photo_path', async () => {
    const res = await request(app)
      .get('/api/workers/2/photo')
      .set('x-test-user', ADMIN);
    expect(res.status).toBe(404);
  });

  it('404s when photo_path is set but the file is missing on disk', async () => {
    const res = await request(app)
      .get('/api/workers/3/photo')
      .set('x-test-user', ADMIN);
    expect(res.status).toBe(404);
  });

  it('404s for an unknown worker id', async () => {
    const res = await request(app)
      .get('/api/workers/404/photo')
      .set('x-test-user', ADMIN);
    expect(res.status).toBe(404);
  });
});
