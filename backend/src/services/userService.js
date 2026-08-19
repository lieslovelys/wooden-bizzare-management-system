import bcrypt from 'bcrypt';
import User from '../models/userModel.js';
import { AppError } from '../errors/AppError.js';

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
        throw new AppError(400, 'You cannot delete your own account',
            { success: false, message: 'You cannot delete your own account' });
    }
    const result = await User.deleteUserById(targetId);
    if (result.length === 0) {
        throw new AppError(404, 'User not found', { success: false, message: 'User not found' });
    }
};

// --- BAGONG FUNCTION PARA SA ACCOUNT LIST ---
const getUsers = () => User.getAllUsers();

const getWorkers = () => User.getAllWorkers();

const addWorker = async (username, password, firstName, middleName, lastName, suffix, workerType, role, contactNumber, dailyRate, photo) => {
    const passwordHash = await bcrypt.hash(password, 10);

    // Kapag blangko yung suffix sa form, gagawin nating 'None' bilang default sa database
    const finalSuffix = suffix || 'None';

    // P1-5: the users row and worker_details row are created in one transaction (see
    // userModel.createWorkerWithDetails) — a failure creating worker_details used to leave
    // an orphaned login with no worker profile.
    await User.createWorkerWithDetails(username, passwordHash, firstName, middleName, lastName, finalSuffix, workerType, role, contactNumber, dailyRate, photo);
};

const updateWorker = async (userId, workerType, role, contactNumber, dailyRate, photo) => {
    // DITO ANG FIX: Kapag empty string ang dailyRate, gagawin nating 0.
    // Kung may laman, pananatilihin natin yung value niya.
    const validRate = dailyRate === "" || dailyRate === null ? 0 : dailyRate;

    // Ipapasa na natin ang 'validRate' imbes na 'dailyRate'
    await User.updateWorkerDetails(userId, workerType, role, contactNumber, validRate, photo);
};

export default {
    createUser,
    login,
    getUsers,
    deleteUser,
    getWorkers,
    addWorker,
    updateWorker
}
