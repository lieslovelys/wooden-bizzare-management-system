// Shared success-envelope builder — see ARCHITECTURE_REVIEW.md P2 "Inconsistent API contract".
// Every 2xx body in this API now answers exactly one of two shapes:
//   { success: true, data }         — ok(data)
//   { success: true, data, meta }   — ok(data, meta), for paginated list endpoints
// `data` defaults to `null` for an endpoint with nothing to return beyond "it worked" (a delete,
// a mark-as-read) — never omitted, so every success body carries the same `success`/`data` keys
// at minimum. The error side of the contract is AppError's default body (errors/AppError.js) —
// there's no equivalent helper for it because every error already flows through one throw site.
export function ok(data = null, meta) {
  return meta === undefined ? { success: true, data } : { success: true, data, meta };
}
