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
    getWorkerPhotoPath: vi.fn(),
    createWorkerDetails: vi.fn(),
    createWorkerWithDetails: vi.fn(),
    updateWorkerDetails: vi.fn(),
  },
}));

// PRD.md C.2 "storage discipline": userService.addWorker/updateWorker/deleteUser/getWorkerPhoto
// all go through utils/photoStorage.js rather than touching `fs` directly — mocked here the same
// way bcrypt is, since what's under test is userService's own file-lifecycle branching (decode
// before create, remove-on-rollback, "undefined keeps the current photo"), not photoStorage's
// own decode/save/remove logic (that's tests/photoStorage.test.js).
vi.mock('../utils/photoStorage.js', () => ({
  default: {
    decodePhotoDataUrl: vi.fn(),
    savePhoto: vi.fn(),
    removePhoto: vi.fn(),
    resolvePhotoPath: vi.fn(),
    photoExistsSync: vi.fn(),
  },
}));

const bcrypt = (await import('bcrypt')).default;
const User = (await import('../models/userModel.js')).default;
const photoStorage = (await import('../utils/photoStorage.js')).default;
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

  it("removes the deleted worker's photo file, best-effort", async () => {
    User.deleteUserById.mockResolvedValue([{ user_id: 2, photo_path: 'abc.jpg' }]);
    await UserService.deleteUser(2, 1);
    expect(photoStorage.removePhoto).toHaveBeenCalledWith('abc.jpg');
  });

  it('does not fail the delete when the deleted user had no photo', async () => {
    User.deleteUserById.mockResolvedValue([{ user_id: 2, photo_path: null }]);
    await UserService.deleteUser(2, 1);
    expect(photoStorage.removePhoto).toHaveBeenCalledWith(null);
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

// PRD.md C.2 "storage discipline" — see photoStorage.js. These cover userService's own
// file-lifecycle branching, not photoStorage's decode/save/remove logic itself (photoStorage is
// fully mocked here — see tests/photoStorage.test.js for that).
describe('userService.addWorker — photo lifecycle', () => {
  beforeEach(() => {
    bcrypt.hash.mockResolvedValue('hashed-value');
  });

  it('decodes and saves the photo BEFORE creating the worker row', async () => {
    photoStorage.decodePhotoDataUrl.mockReturnValue({ buffer: Buffer.from('x'), ext: 'jpg' });
    photoStorage.savePhoto.mockResolvedValue('new-uuid.jpg');
    User.createWorkerWithDetails.mockResolvedValue({ user: {}, details: {} });

    await UserService.addWorker(
      'bob', 'pw', 'Bob', '', 'Smith', '', 'Regular', 'Carpenter', '09171234567', 500,
      'data:image/jpeg;base64,eA==',
    );

    expect(photoStorage.decodePhotoDataUrl).toHaveBeenCalledWith('data:image/jpeg;base64,eA==');
    expect(photoStorage.savePhoto).toHaveBeenCalledWith(Buffer.from('x'), 'jpg');
    // createWorkerWithDetails's last argument is the saved FILENAME, never the raw data URL.
    const args = User.createWorkerWithDetails.mock.calls[0];
    expect(args[args.length - 1]).toBe('new-uuid.jpg');
  });

  it('never touches photoStorage when no photo is given', async () => {
    User.createWorkerWithDetails.mockResolvedValue({ user: {}, details: {} });
    await UserService.addWorker(
      'bob', 'pw', 'Bob', '', 'Smith', '', 'Regular', 'Carpenter', '09171234567', 500, null,
    );
    expect(photoStorage.decodePhotoDataUrl).not.toHaveBeenCalled();
    expect(photoStorage.savePhoto).not.toHaveBeenCalled();
    const args = User.createWorkerWithDetails.mock.calls[0];
    expect(args[args.length - 1]).toBeNull();
  });

  it('a bad photo 400s before the database is ever touched', async () => {
    photoStorage.decodePhotoDataUrl.mockImplementation(() => { throw new AppError(400, 'bad photo'); });
    await expect(UserService.addWorker(
      'bob', 'pw', 'Bob', '', 'Smith', '', 'Regular', 'Carpenter', '09171234567', 500, 'garbage',
    )).rejects.toMatchObject({ status: 400 });
    expect(User.createWorkerWithDetails).not.toHaveBeenCalled();
  });

  it('removes the just-saved file if creating the worker row fails', async () => {
    photoStorage.decodePhotoDataUrl.mockReturnValue({ buffer: Buffer.from('x'), ext: 'jpg' });
    photoStorage.savePhoto.mockResolvedValue('new-uuid.jpg');
    const dbError = new Error('duplicate username');
    User.createWorkerWithDetails.mockRejectedValue(dbError);

    await expect(UserService.addWorker(
      'bob', 'pw', 'Bob', '', 'Smith', '', 'Regular', 'Carpenter', '09171234567', 500,
      'data:image/jpeg;base64,eA==',
    )).rejects.toBe(dbError);

    expect(photoStorage.removePhoto).toHaveBeenCalledWith('new-uuid.jpg');
  });
});

describe('userService.updateWorker — photo lifecycle', () => {
  it('an absent photo (undefined) keeps the current one, with no file I/O at all', async () => {
    User.updateWorkerDetails.mockResolvedValue({ details: {}, previousPhotoPath: 'old.jpg' });

    await UserService.updateWorker(2, 'Regular', 'Carpenter', '09171234567', 500, undefined);

    expect(photoStorage.decodePhotoDataUrl).not.toHaveBeenCalled();
    expect(photoStorage.savePhoto).not.toHaveBeenCalled();
    expect(photoStorage.removePhoto).not.toHaveBeenCalled();
    expect(User.updateWorkerDetails).toHaveBeenCalledWith(
      2, 'Regular', 'Carpenter', '09171234567', 500,
      { photoChanged: false, photoPath: null },
    );
  });

  it('a new photo string saves the file, then removes the previous one after commit', async () => {
    photoStorage.decodePhotoDataUrl.mockReturnValue({ buffer: Buffer.from('x'), ext: 'png' });
    photoStorage.savePhoto.mockResolvedValue('new.png');
    User.updateWorkerDetails.mockResolvedValue({ details: {}, previousPhotoPath: 'old.jpg' });

    await UserService.updateWorker(2, 'Regular', 'Carpenter', '09171234567', 500, 'data:image/png;base64,eA==');

    expect(User.updateWorkerDetails).toHaveBeenCalledWith(
      2, 'Regular', 'Carpenter', '09171234567', 500,
      { photoChanged: true, photoPath: 'new.png' },
    );
    expect(photoStorage.removePhoto).toHaveBeenCalledWith('old.jpg');
    expect(photoStorage.removePhoto).not.toHaveBeenCalledWith('new.png');
  });

  it('null clears the photo outright and removes the old file', async () => {
    User.updateWorkerDetails.mockResolvedValue({ details: {}, previousPhotoPath: 'old.jpg' });

    await UserService.updateWorker(2, 'Regular', 'Carpenter', '09171234567', 500, null);

    expect(photoStorage.decodePhotoDataUrl).not.toHaveBeenCalled();
    expect(User.updateWorkerDetails).toHaveBeenCalledWith(
      2, 'Regular', 'Carpenter', '09171234567', 500,
      { photoChanged: true, photoPath: null },
    );
    expect(photoStorage.removePhoto).toHaveBeenCalledWith('old.jpg');
  });

  it('removes the just-saved file (not the previous one) if the model update fails', async () => {
    photoStorage.decodePhotoDataUrl.mockReturnValue({ buffer: Buffer.from('x'), ext: 'jpg' });
    photoStorage.savePhoto.mockResolvedValue('new.jpg');
    const dbError = new Error('constraint violation');
    User.updateWorkerDetails.mockRejectedValue(dbError);

    await expect(UserService.updateWorker(
      2, 'Regular', 'Carpenter', '09171234567', 500, 'data:image/jpeg;base64,eA==',
    )).rejects.toBe(dbError);

    expect(photoStorage.removePhoto).toHaveBeenCalledWith('new.jpg');
    expect(photoStorage.removePhoto).toHaveBeenCalledTimes(1);
  });

  it('a bad new photo 400s before the model is ever called', async () => {
    photoStorage.decodePhotoDataUrl.mockImplementation(() => { throw new AppError(400, 'bad photo'); });
    await expect(UserService.updateWorker(
      2, 'Regular', 'Carpenter', '09171234567', 500, 'garbage',
    )).rejects.toMatchObject({ status: 400 });
    expect(User.updateWorkerDetails).not.toHaveBeenCalled();
  });
});

describe('userService.getWorkerPhoto', () => {
  it('resolves the absolute path for a worker with a photo on file', async () => {
    User.getWorkerPhotoPath.mockResolvedValue('abc.jpg');
    photoStorage.photoExistsSync.mockReturnValue(true);
    photoStorage.resolvePhotoPath.mockReturnValue('/uploads/abc.jpg');

    const result = await UserService.getWorkerPhoto(5);
    expect(result).toEqual({ fullPath: '/uploads/abc.jpg', photoPath: 'abc.jpg' });
  });

  it('404s when the worker has no photo_path at all', async () => {
    User.getWorkerPhotoPath.mockResolvedValue(null);
    await expect(UserService.getWorkerPhoto(5)).rejects.toMatchObject({ status: 404 });
  });

  it('404s when photo_path is set but the file is missing on disk', async () => {
    User.getWorkerPhotoPath.mockResolvedValue('gone.jpg');
    photoStorage.photoExistsSync.mockReturnValue(false);
    await expect(UserService.getWorkerPhoto(5)).rejects.toMatchObject({ status: 404 });
  });
});
