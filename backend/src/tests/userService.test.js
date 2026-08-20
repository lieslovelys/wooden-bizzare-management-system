import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '../errors/AppError.js';

// userService.login is the P0-5 fix (ARCHITECTURE_REVIEW.md: "Login crashes and leaks internals
// on an unknown username") and the enumeration-oracle guarantee PRD C.3 requires ("login
// failures return a uniform response regardless of whether the username exists"). Neither had
// any test coverage before this file. bcrypt is mocked — real bcrypt at 10 rounds is ~100ms per
// call and would dominate this suite's runtime for no benefit, since what's under test is
// userService's own branching, not bcrypt itself.

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}));

vi.mock('../models/userModel.js', () => ({
  default: {
    getUserByUsername: vi.fn(),
    createUser: vi.fn(),
    getAllUsers: vi.fn(),
    deleteUserById: vi.fn(),
    getAllWorkers: vi.fn(),
    createWorkerDetails: vi.fn(),
    createWorkerWithDetails: vi.fn(),
    updateWorkerDetails: vi.fn(),
  },
}));

const bcrypt = (await import('bcrypt')).default;
const User = (await import('../models/userModel.js')).default;
const UserService = (await import('../services/userService.js')).default;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('userService.login', () => {
  it('produces a byte-identical 401 for an unknown username and a wrong password', async () => {
    User.getUserByUsername.mockResolvedValueOnce([]); // unknown username
    const unknownUserResult = await UserService.login('ghost', 'anything').catch((e) => e);

    User.getUserByUsername.mockResolvedValueOnce([{ user_id: 1, user_password: 'hash' }]);
    bcrypt.compare.mockResolvedValueOnce(false); // wrong password
    const wrongPasswordResult = await UserService.login('real-user', 'wrong').catch((e) => e);

    // The actual enumeration-oracle property: these two failures must be indistinguishable to
    // the caller. Asserting they equal each other (not just that both are "a 401 shape") is
    // what would actually fail if one message were later worded differently from the other.
    expect(unknownUserResult).toBeInstanceOf(AppError);
    expect(wrongPasswordResult).toBeInstanceOf(AppError);
    expect(unknownUserResult.status).toBe(wrongPasswordResult.status);
    expect(unknownUserResult.message).toBe(wrongPasswordResult.message);
    expect(unknownUserResult.body).toEqual(wrongPasswordResult.body);
  });

  it('resolves with the user row on a correct password', async () => {
    const row = { user_id: 1, username: 'real-user', user_password: 'hash', user_role: 'Admin' };
    User.getUserByUsername.mockResolvedValue([row]);
    bcrypt.compare.mockResolvedValue(true);
    const result = await UserService.login('real-user', 'correct');
    expect(result).toEqual(row);
  });

  it('lets a model failure propagate instead of being reported as an auth failure', async () => {
    const dbError = new Error('connection reset');
    User.getUserByUsername.mockRejectedValue(dbError);
    await expect(UserService.login('real-user', 'x')).rejects.toBe(dbError);
  });
});

describe('userService.deleteUser', () => {
  it('400s a self-delete attempt before touching the model', async () => {
    await expect(UserService.deleteUser(1, 1)).rejects.toMatchObject({ status: 400 });
    expect(User.deleteUserById).not.toHaveBeenCalled();
  });

  it('404s when the model deletes nothing', async () => {
    User.deleteUserById.mockResolvedValue([]);
    await expect(UserService.deleteUser(2, 1)).rejects.toMatchObject({ status: 404 });
  });

  it('resolves silently on a real delete of someone else', async () => {
    User.deleteUserById.mockResolvedValue([{ user_id: 2 }]);
    await expect(UserService.deleteUser(2, 1)).resolves.toBeUndefined();
  });

  it('treats numeric and string ids for the same account as a self-delete', async () => {
    // The route passes req.params.id (a string) alongside req.session.user.user_id (a number);
    // deleteUser's own String() coercion is what makes "1" and 1 compare equal.
    await expect(UserService.deleteUser('1', 1)).rejects.toMatchObject({ status: 400 });
    expect(User.deleteUserById).not.toHaveBeenCalled();
  });
});

describe('userService.createUser / addWorker — password handling', () => {
  it('createUser passes the bcrypt hash to the model, never the plaintext password', async () => {
    bcrypt.hash.mockResolvedValue('hashed-value');
    User.createUser.mockResolvedValue([{ user_id: 1 }]);

    await UserService.createUser('alice', 'plaintext-pw', 'Alice', '', 'Doe', 'None', 'Admin');

    expect(bcrypt.hash).toHaveBeenCalledWith('plaintext-pw', 10);
    const passedPassword = User.createUser.mock.calls[0][1];
    expect(passedPassword).toBe('hashed-value');
    expect(passedPassword).not.toBe('plaintext-pw');
  });

  it('addWorker passes the bcrypt hash to the model, never the plaintext password', async () => {
    bcrypt.hash.mockResolvedValue('hashed-value');
    User.createWorkerWithDetails.mockResolvedValue({ user: {}, details: {} });

    await UserService.addWorker(
      'bob', 'plaintext-pw', 'Bob', '', 'Smith', '', 'Regular', 'Carpenter', '09171234567', 500, null,
    );

    expect(bcrypt.hash).toHaveBeenCalledWith('plaintext-pw', 10);
    const passedPassword = User.createWorkerWithDetails.mock.calls[0][1];
    expect(passedPassword).toBe('hashed-value');
    expect(passedPassword).not.toBe('plaintext-pw');
  });
});
