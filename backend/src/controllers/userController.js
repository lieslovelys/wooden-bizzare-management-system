import bcrypt from 'bcrypt';
import User from '../models/userModel.js';

const createUser = async (username, password, first_name, middle_name, last_name, suffix, user_role) => {
    try{
        const passwordHash = await bcrypt.hash(password, 10);
        const result = await User.createUser(username, passwordHash, first_name, middle_name, last_name, suffix, user_role);
        console.log(result);
        return result;
    }
    catch(e){
        console.log(e);
        return e;
    }
};

const login = async (username, password) => {
    try{
        const result = await User.getUserByUsername(username);
        const matched = await bcrypt.compare(password, result[0].user_password);
        if(matched){
            console.log('password matched');
            return {err: false, user: result};
        }
        else{
            console.log('wrong');
            return {err: true, message:'Wrong Password'};
        }
    }
    catch(e){
        return e;
    }
};

const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
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

        // Pinalitan natin yung blangkong string dati ng mismong middleName variable
        const newUser = await User.createUser(username, passwordHash, firstName, middleName, lastName, finalSuffix, 'Worker');

        if (newUser && newUser.length > 0) {
            const userId = newUser[0].user_id; 
            
            await User.createWorkerDetails(userId, workerType, role, contactNumber, dailyRate, photo);

            res.status(200).json({ success: true, message: 'Worker added successfully' });
        } else {
            res.status(400).json({ success: false, message: 'Failed to create user account' });
        }
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