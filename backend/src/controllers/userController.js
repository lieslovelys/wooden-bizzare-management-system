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
}



export default {
    createUser,
    login
}