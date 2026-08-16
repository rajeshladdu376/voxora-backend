function adminMiddleware(req, res, next) {
  if (!req.client) {
    return res.status(401).json({
      success: false,
      error: "Authentication required."
    });
  }

  if (req.client.role !== "admin") {
    return res.status(403).json({
      success: false,
      error: "Admin access required."
    });
  }

  next();
}

module.exports = adminMiddleware;