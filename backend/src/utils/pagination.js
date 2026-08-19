// Shared pagination parsing for every list route — see CLAUDE.md / ARCHITECTURE_REVIEW.md P1-3.
// Unlike routes/adminNotifRoutes.js's old parseTypeQuery (which wrote into `res` directly and
// returned {ok:false} for the caller to `return` on), this throws AppError and needs no special
// handling at the call site — Express 5 forwards a rejected promise to errorHandler
// automatically, same as every other thrown AppError in this codebase.
//
// Deliberately NOT folded into the zod schemas in schemas/ (P2 "input validation library"):
// this already throws AppError, is exhaustively covered by tests/pagination.test.js, and has
// bespoke clamp-don't-reject behavior on `limit` that a generic schema would just reimplement.
import { AppError } from '../errors/AppError.js';

export const DEFAULT_LIMIT = 25;
export const MAX_LIMIT = 200;

// query: the route's req.query. Returns { page, limit, offset }.
// `page` defaults to 1, `limit` defaults to `defaultLimit`. A `limit` above `maxLimit` is
// clamped down rather than rejected, so a client asking for "too much" gets the cap instead of
// an error. Non-integer or non-positive values are rejected outright — there is no sane clamp
// for `page=abc` or `page=0`.
export function parsePagination(query, { defaultLimit = DEFAULT_LIMIT, maxLimit = MAX_LIMIT } = {}) {
    const rawPage = query.page;
    const rawLimit = query.limit;

    let page = 1;
    if (rawPage !== undefined) {
        page = Number(rawPage);
        if (!Number.isInteger(page) || page < 1) {
            throw new AppError(400, 'Invalid page/limit', { error: 'page must be a positive integer.' });
        }
    }

    let limit = defaultLimit;
    if (rawLimit !== undefined) {
        limit = Number(rawLimit);
        if (!Number.isInteger(limit) || limit < 1) {
            throw new AppError(400, 'Invalid page/limit', { error: 'limit must be a positive integer.' });
        }
    }
    if (limit > maxLimit) limit = maxLimit;

    const offset = (page - 1) * limit;
    return { page, limit, offset };
}

// Builds the { page, limit, total, totalPages } block for a paginated response.
export function buildMeta({ page, limit, total }) {
    return {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    };
}

// Models add `COUNT(*) OVER() AS total_count` to a paginated query so the total comes back in
// the same round trip (P1-6 precedent: one query beats a second one on a small connection pool).
// This strips that column back off each row and lifts it into a single `total`.
export function splitCountedRows(rows) {
    if (rows.length === 0) return { rows: [], total: 0 };
    const total = Number(rows[0].total_count);
    const cleaned = rows.map(({ total_count, ...rest }) => rest);
    return { rows: cleaned, total };
}
