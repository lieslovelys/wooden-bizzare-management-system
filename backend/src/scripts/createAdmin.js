// One-time CLI script to bootstrap the very first Admin account on a fresh database.
// Not an HTTP endpoint — POST /signup now requires an existing Admin session (see
// routes/userRoutes.js), so this is the only way to create the first account.
//
// Usage (from backend/src):
//   node scripts/createAdmin.js <username> <password> [firstName] [lastName]
//
// Requires the same environment as the server (backend/src/.env) since it uses the same
// db connection and user-creation logic.

import 'dotenv/config';
import User from '../services/userService.js';

async function main() {
    const [, , username, password, firstName = 'Admin', lastName = 'User'] = process.argv;

    if (!username || !password) {
        console.error('Usage: node scripts/createAdmin.js <username> <password> [firstName] [lastName]');
        process.exit(1);
    }
    if (password.length < 8) {
        console.error('Password must be at least 8 characters.');
        process.exit(1);
    }

    try {
        const result = await User.createUser(username, password, firstName, '', lastName, 'None', 'Admin');
        const created = Array.isArray(result) ? result[0] : result;
        console.log(`Admin account created: user_id=${created.user_id}, username=${created.username}`);
        console.log('Log in and change this password from the Admin UI as soon as possible.');
    } catch (err) {
        console.error('Failed to create admin account:', err.message);
        process.exit(1);
    }
    process.exit(0);
}

main();
