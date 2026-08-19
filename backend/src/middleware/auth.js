// Authorization middleware. Applied per-route inside each router file — never mounted
// app-wide — so the SPA catch-all and the public auth routes (/login, /session-user, /logout)
// are never accidentally gated.

export function requireAuth(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session?.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.session.user.user_role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

// Allows either: the caller's own user_id matches req.params[paramName] (e.g. a Worker reading
// their own task list), OR the caller's role is in `roles` (e.g. Admin oversight).
export function requireSelfOrRole(paramName, ...roles) {
  return (req, res, next) => {
    if (!req.session?.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const isSelf = String(req.session.user.user_id) === String(req.params[paramName]);
    const hasRole = roles.includes(req.session.user.user_role);
    if (!isSelf && !hasRole) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}
