// One-time CLI script to seed sample accounts for local development/testing — one per role, plus
// one Worker per STAGE role (Carpenter/Carver/Liha/Painter/Delivery). Writes their credentials to
// docs/tmp/sample-accounts.md (gitignored — see the root .gitignore) rather than printing them,
// since that file is meant to be kept around and referred back to, not just scrolled past once.
//
// Usage (from backend/src):
//   npm run seed:accounts
//
// Requires the same environment as the server (backend/src/.env). Refuses to run with
// NODE_ENV=production — these are throwaway logins with randomly generated passwords, and must
// never end up seeded onto the deployed VPS database.
//
// Idempotent: a username that already exists is left untouched (its row is NOT updated, and its
// real password is never known to this script, so the output file says so instead of a
// password). Safe to re-run after partially failing, or just to top up accounts deleted since the
// last run.
//
// Deliberately plain console.log/console.error, not config/logger.js — see migrate.js's comment
// on why: a one-shot CLI tool a human runs directly, not request/application logging.

import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import User from '../services/userService.js';
import UserModel from '../models/userModel.js';

if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to seed sample accounts with NODE_ENV=production.');
    process.exit(1);
}

// role/workerFields: Worker accounts also need job_type/job_role/contact/rate — the rest are
// created through the same path as a real Admin-created account (userService.createUser).
const ACCOUNTS = [
    { username: 'sample.admin', firstName: 'Juan', lastName: 'Dela Cruz', userRole: 'Admin' },
    { username: 'sample.pm', firstName: 'Maria', lastName: 'Santos', userRole: 'Production Manager' },
    { username: 'sample.inventory', firstName: 'Pedro', lastName: 'Reyes', userRole: 'Inventory Staff' },
    { username: 'sample.qc', firstName: 'Ana', lastName: 'Bautista', userRole: 'Quality Checker' },
    {
        username: 'sample.carpenter', firstName: 'Carlos', lastName: 'Mendoza', userRole: 'Worker',
        workerType: 'Regular', role: 'Carpenter', contactNumber: '09171234501', dailyRate: 650,
    },
    {
        username: 'sample.carver', firstName: 'Liza', lastName: 'Fernandez', userRole: 'Worker',
        workerType: 'Part-Time', role: 'Carver', contactNumber: '09171234502', dailyRate: 600,
    },
    {
        username: 'sample.liha', firstName: 'Ramon', lastName: 'Garcia', userRole: 'Worker',
        workerType: 'Regular', role: 'Liha', contactNumber: '09171234503', dailyRate: 600,
    },
    {
        username: 'sample.painter', firstName: 'Teresa', lastName: 'Aquino', userRole: 'Worker',
        workerType: 'Part-Time', role: 'Painter', contactNumber: '09171234504', dailyRate: 625,
    },
    {
        username: 'sample.delivery', firstName: 'Jose', lastName: 'Ramirez', userRole: 'Worker',
        workerType: 'Regular', role: 'Delivery', contactNumber: '09171234505', dailyRate: 580,
    },
];

// 12 random bytes, base64url-encoded, is 16 characters — well past the 8-character floor
// schemas/userSchemas.js's accountBody enforces for a real Admin-created account.
function generatePassword() {
    return randomBytes(12).toString('base64url');
}

async function seedOne(account) {
    const existing = await UserModel.getUserByUsername(account.username);
    if (existing.length > 0) {
        return { ...account, status: 'skipped', password: null };
    }

    const password = generatePassword();
    const fullName = `${account.firstName} ${account.lastName}`;

    if (account.userRole === 'Worker') {
        await User.addWorker(
            account.username, password, account.firstName, '', account.lastName, 'None',
            account.workerType, account.role, account.contactNumber, account.dailyRate, null
        );
    } else {
        await User.createUser(account.username, password, account.firstName, '', account.lastName, 'None', account.userRole);
    }

    console.log(`Created ${account.userRole}: ${account.username} (${fullName})`);
    return { ...account, status: 'created', password, fullName };
}

const SKIPPED_PLACEHOLDER = '*(already existed — not changed by this run)*';
// Matches one credentials-table row this file itself generates — used to carry a previously
// recorded password forward across a re-run, so re-running the script never destroys the one
// record of a password this script (deliberately) never writes anywhere else.
const ROW_PATTERN = /^\| [^|]+ \| `([^`]+)` \| ([^|]+) \| [^|]+ \|$/gm;

function readPreviousPasswords(mdPath) {
    if (!existsSync(mdPath)) return new Map();
    const content = readFileSync(mdPath, 'utf-8');
    const previous = new Map();
    for (const match of content.matchAll(ROW_PATTERN)) {
        const [, username, password] = match;
        if (password.trim() !== SKIPPED_PLACEHOLDER) {
            previous.set(username, password.trim());
        }
    }
    return previous;
}

function writeCredentialsFile(results) {
    const thisFile = fileURLToPath(import.meta.url);
    // backend/src/scripts -> backend/src -> backend -> repo root
    const repoRoot = path.join(path.dirname(thisFile), '..', '..', '..');
    const outDir = path.join(repoRoot, 'docs', 'tmp');
    mkdirSync(outDir, { recursive: true });
    const mdPath = path.join(outDir, 'sample-accounts.md');

    const previousPasswords = readPreviousPasswords(mdPath);

    const rows = results.map((r) => {
        const name = `${r.firstName} ${r.lastName}`;
        // A freshly created account's password is known outright. A skipped (already-existing)
        // account's password is only known if a PREVIOUS run of this same script recorded it —
        // reusing that keeps a re-run from overwriting the one place that password is written
        // down; an account this script never created (or whose record predates this file)
        // falls back to the placeholder, since its real password genuinely isn't known here.
        const password = r.status === 'created'
            ? r.password
            : (previousPasswords.get(r.username) ?? SKIPPED_PLACEHOLDER);
        return `| ${r.userRole} | \`${r.username}\` | ${password} | ${name} |`;
    });

    const content = `# Sample accounts

Generated by \`npm run seed:accounts\` (\`backend/src/scripts/seedSampleAccounts.js\`) on
${new Date().toISOString()}.

This file is listed in the root \`.gitignore\` (under \`docs/tmp/\`) and never leaves this
machine — these are real, working passwords on whatever database \`backend/src/.env\` points at.

| Role | Username | Password | Name |
|---|---|---|---|
${rows.join('\n')}

To remove an account: log in as \`sample.admin\` (or any other Admin), go to
**Account Creation → Account List**, and delete it from there.
`;

    writeFileSync(mdPath, content);
    return mdPath;
}

async function main() {
    const results = [];
    for (const account of ACCOUNTS) {
        try {
            results.push(await seedOne(account));
        } catch (err) {
            console.error(`Failed to seed ${account.username}:`, err.message);
            process.exit(1);
        }
    }

    const outPath = writeCredentialsFile(results);
    const createdCount = results.filter((r) => r.status === 'created').length;
    const skippedCount = results.length - createdCount;
    console.log(`\n${createdCount} account(s) created, ${skippedCount} already existed (skipped).`);
    console.log(`Credentials written to ${outPath}`);
    process.exit(0);
}

main();
