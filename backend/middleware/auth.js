const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * requireAuth — Express middleware that validates a Bearer JWT from the
 * Authorization header.  Attaches the decoded payload to req.jwtUser.
 *
 * Routes that should be public (login, send-otp, verify-otp, /api/config)
 * must NOT use this middleware.
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authorization token required.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.jwtUser = decoded;
    next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? 'Token expired.' : 'Invalid token.';
    return res.status(401).json({ success: false, error: message });
  }
}

/**
 * requireAdmin — builds on requireAuth; additionally rejects non-admin roles.
 */
function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.jwtUser?.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required.' });
    }
    next();
  });
}

module.exports = { requireAuth, requireAdmin };
