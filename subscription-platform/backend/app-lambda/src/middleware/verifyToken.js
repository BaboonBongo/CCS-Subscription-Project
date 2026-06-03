const jwt = require("jsonwebtoken");

/**
 * JWT Bearer token verification middleware.
 *
 * Reads the Authorization header, extracts the Bearer token,
 * verifies it with jwt.verify(), and puts the decoded payload
 * on req.user for downstream route handlers.
 *
 * Returns 401 if the token is missing or invalid.
 */
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

module.exports = verifyToken;
