import { query } from "../config/db.js";

const createUser = async (username, password, first_name, middle_name, last_name, suffix, user_role) => {
    try{
        const result = await query(`INSERT INTO users (username, user_password, first_name, middle_name, last_name, suffix, user_role)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`, [username, password, first_name, middle_name, last_name, suffix, user_role]);
        
        return result.rows;
    }
    catch(e){
        return e;
    }
}

const getUserByUsername = async (username) => {
    try{
        const result = await query('SELECT * FROM users WHERE username = $1', [username]);
        return result.rows;
    }
    catch(e){
        return e;
    }
}

export default {
    getUserByUsername,
    createUser
}