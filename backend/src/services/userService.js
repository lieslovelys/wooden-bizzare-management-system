import bcrypt from 'bcrypt';
import User from '../models/userModel.js';
import { AppError } from '../errors/AppError.js';
import photoStorage from '../utils/photoStorage.js';

const createUser = async (username, password, first_name, middle_name, last_name, suffix, user_role) => {
    const passwordHash = await bcrypt.hash(password, 10);
    // Let any failure (duplicate username, invalid enum value, DB error) propagate — the caller
    // (a route with no try/catch) is responsible for turning it into a sanitized response. Never
    // swallow it and return it as if it were data.
    return await User.createUser(username, passwordHash, first_name, middle_name, last_name, suffix, user_role);
};

// Throws the same AppError for both "unknown user" and "wrong password" — deliberately the
// same shape for both, so the response can never be used to enumerate valid usernames. Any
// unexpected failure (DB down, etc.) is left to throw and propagate to the centralized error
// handler rather than being caught and misrepresented as an auth failure.
const login = async (username, password) => {
    const result = await User.getUserByUsername(username);
    if (result.length === 0) {
        throw new AppError(401, 'Invalid username or password');
    }
    const matched = await bcrypt.compare(password, result[0].user_password);
    if (!matched) {
        throw new AppError(401, 'Invalid username or password');
    }
    return result[0];
};

const deleteUser = async (targetId, callerId) => {
    if (String(callerId) === String(targetId)) {
        throw new AppError(400, 'You cannot delete your own account');
    }
    const result = await User.deleteUserById(targetId);
    if (result.length === 0) {
        throw new AppError(404, 'User not found');
    }
    // Best-effort — see photoStorage.removePhoto. The row is already gone either way.
    await photoStorage.removePhoto(result[0].photo_path);
};

// --- BAGONG FUNCTION PARA SA ACCOUNT LIST ---
const getUsers = (pagination) => User.getAllUsers(pagination);

const getWorkers = (pagination) => User.getAllWorkers(pagination);

// `photo` is a `data:image/...;base64,...` string, or null/undefined for "no photo" — decoded
// and saved to disk BEFORE the users/worker_details rows are created, so a bad photo 400s
// without ever touching the database. If the (transactional) row creation then fails for an
// unrelated reason, the just-written file is removed rather than left orphaned.
const addWorker = async (username, password, firstName, middleName, lastName, suffix, workerType, role, contactNumber, dailyRate, photo) => {
    const passwordHash = await bcrypt.hash(password, 10);

    // Kapag blangko yung suffix sa form, gagawin nating 'None' bilang default sa database
    const finalSuffix = suffix || 'None';

    let photoPath = null;
    if (photo) {
        const { buffer, ext } = photoStorage.decodePhotoDataUrl(photo);
        photoPath = await photoStorage.savePhoto(buffer, ext);
    }

    try {
        // P1-5: the users row and worker_details row are created in one transaction (see
        // userModel.createWorkerWithDetails) — a failure creating worker_details used to leave
        // an orphaned login with no worker profile.
        await User.createWorkerWithDetails(username, passwordHash, firstName, middleName, lastName, finalSuffix, workerType, role, contactNumber, dailyRate, photoPath);
    } catch (e) {
        await photoStorage.removePhoto(photoPath);
        throw e;
    }
};

// `photo` has three meaningful states, and they must stay distinguishable all the way from the
// route to here (see routes/userRoutes.js's destructure and schemas/userSchemas.js's
// `.optional().nullable()`):
//   - undefined (the key was absent from the request body): keep whatever photo is already on
//     file — no file I/O at all. This is what makes "edit worker" safe now that the worker list
//     no longer round-trips the photo on every request.
//   - a data URL string: decode, save as a new file, and replace the old one.
//   - null: clear the photo outright.
const updateWorker = async (userId, workerType, role, contactNumber, dailyRate, photo) => {
    // DITO ANG FIX: Kapag empty string ang dailyRate, gagawin nating 0.
    // Kung may laman, pananatilihin natin yung value niya.
    const validRate = dailyRate === "" || dailyRate === null ? 0 : dailyRate;

    const photoChanged = photo !== undefined;
    let newPhotoPath = null;
    if (photoChanged && photo !== null) {
        const { buffer, ext } = photoStorage.decodePhotoDataUrl(photo);
        newPhotoPath = await photoStorage.savePhoto(buffer, ext);
    }

    let previousPhotoPath;
    try {
        ({ previousPhotoPath } = await User.updateWorkerDetails(
            userId, workerType, role, contactNumber, validRate,
            { photoChanged, photoPath: newPhotoPath }
        ));
    } catch (e) {
        if (photoChanged) await photoStorage.removePhoto(newPhotoPath);
        throw e;
    }

    // Only reached once the new value has actually committed — the old file becomes safe to
    // remove now, whether it was replaced by a new one or cleared outright.
    if (photoChanged) await photoStorage.removePhoto(previousPhotoPath);
};

// GET /api/workers/:id/photo — resolves a worker id to an absolute, on-disk path, never trusting
// anything the client sent about the filename itself (see photoStorage.resolvePhotoPath).
const getWorkerPhoto = async (userId) => {
    const photoPath = await User.getWorkerPhotoPath(userId);
    if (!photoPath || !photoStorage.photoExistsSync(photoPath)) {
        throw new AppError(404, 'No photo on file for this worker');
    }
    return { fullPath: photoStorage.resolvePhotoPath(photoPath), photoPath };
};

export default {
    createUser,
    login,
    getUsers,
    deleteUser,
    getWorkers,
    addWorker,
    updateWorker,
    getWorkerPhoto,
}
