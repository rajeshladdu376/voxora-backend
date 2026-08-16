const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

function authMiddleware(req, res, next) {
  // Get token from header
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      error: "Authorization token required."
    });
  }

  // Expected format: Bearer TOKEN
  const token = authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: "Invalid token format."
    });
  }

  try {
 const decoded = jwt.verify(token, JWT_SECRET);

    // Store user data for later use
    req.client = decoded;

    next();

  } catch (error) {
    return res.status(401).json({
      error: "Invalid or expired token."
    });
  }
}

module.exports = authMiddleware;