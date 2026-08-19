import bcrypt from 'bcrypt';
import User from '../models/userModel.js';

const createUser = async (username, password, first_name, middle_name, last_name, suffix, user_role) => {
    const passwordHash = await bcrypt.hash(password, 10);
    // Let any failure (duplicate username, invalid enum value, DB error) propagate — the caller
    // (a route with no try/catch, or the centralized error handler) is responsible for turning
    // it into a sanitized response. Never swallow it and return it as if it were data.
    return await User.createUser(username, passwordHash, first_name, middle_name, last_name, suffix, user_role);
};

// Returns {err:true, message} for both "unknown user" and "wrong password" — deliberately the
// same shape for both, so the response can never be used to enumerate valid usernames. Any
// unexpected failure (DB down, etc.) is left to throw and propagate to the centralized error
// handler rather than being caught and misrepresented as an auth failure.
const login = async (username, password) => {
    const result = await User.getUserByUsername(username);
    if (result.length === 0) {
        return { err: true, message: 'Invalid username or password' };
    }
    const matched = await bcrypt.compare(password, result[0].user_password);
    if (!matched) {
        return { err: true, message: 'Invalid username or password' };
    }
    return { err: false, user: result };
};

const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        if (String(req.session.user.user_id) === String(id)) {
            return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
        }
        const result = await User.deleteUserById(id);

        if (result.length > 0) {
            res.status(200).json({ success: true, message: 'User deleted successfully' });
        } else {
            res.status(404).json({ success: false, message: 'User not found' });
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// --- BAGONG FUNCTION PARA SA ACCOUNT LIST ---
const getUsers = async (req, res) => {
    try {
        // Kukunin natin yung data mula sa userModel
        const users = await User.getAllUsers();
        // Ise-send natin pabalik sa React frontend mo as JSON
        res.status(200).json({ success: true, data: users });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ success: false, message: 'Server error while fetching users' });
    }
};

const getWorkers = async (req, res) => {
    try {
        const workers = await User.getAllWorkers();
        res.status(200).json({ success: true, data: workers });
    } catch (error) {
        console.error('Error fetching workers:', error);
        res.status(500).json({ success: false, message: 'Server error while fetching workers' });
    }
};

const addWorker = async (req, res) => {
    try {
        // Dinagdag natin ang middleName at suffix dito
        const { username, password, firstName, middleName, lastName, suffix, workerType, role, contactNumber, dailyRate, photo } = req.body;

        const passwordHash = await bcrypt.hash(password, 10);

        // Kapag blangko yung suffix sa form, gagawin nating 'None' bilang default sa database
        const finalSuffix = suffix || 'None';

        // P1-5: the users row and worker_details row are created in one transaction (see
        // userModel.createWorkerWithDetails) — a failure creating worker_details used to leave
        // an orphaned login with no worker profile.
        await User.createWorkerWithDetails(username, passwordHash, firstName, middleName, lastName, finalSuffix, workerType, role, contactNumber, dailyRate, photo);

        res.status(200).json({ success: true, message: 'Worker added successfully' });
    } catch (error) {
        console.error('Error adding worker:', error);
        res.status(500).json({ success: false, message: 'Server error while adding worker' });
    }
};

const updateWorker = async (req, res) => {
    try {
        const userId = req.params.id; 
        const { workerType, role, contactNumber, dailyRate, photo } = req.body; 

        // DITO ANG FIX: Kapag empty string ang dailyRate, gagawin nating 0.
        // Kung may laman, pananatilihin natin yung value niya.
        const validRate = dailyRate === "" || dailyRate === null ? 0 : dailyRate;

        // Ipapasa na natin ang 'validRate' imbes na 'dailyRate'
        await User.updateWorkerDetails(userId, workerType, role, contactNumber, validRate, photo);
        
        res.status(200).json({ success: true, message: 'Worker details updated successfully' });
    } catch (error) {
        console.error('Error updating worker:', error);
        res.status(500).json({ success: false, message: 'Server error while updating worker' });
    }
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