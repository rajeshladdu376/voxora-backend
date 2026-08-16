function validateBody(fields) {
  return (req, res, next) => {
    const missing = fields.filter((f) => {
      const val = req.body[f];
      return val === undefined || val === null || (typeof val === 'string' && !val.trim());
    });

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Missing required fields',
          fields: missing,
          status: 400,
        },
      });
    }

    next();
  };
}

module.exports = { validateBody };
