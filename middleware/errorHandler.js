function notFound(req, res, next) {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.status = 404;
  next(error);
}

function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;

  if (process.env.NODE_ENV !== 'production') {
    console.error(`[ERROR] ${status} - ${err.message}`);
    if (status === 500) console.error(err.stack);
  }

  res.status(status).json({
    success: false,
    error: {
      message: err.message || 'Internal Server Error',
      status,
      ...(process.env.NODE_ENV !== 'production' && status === 500 && { stack: err.stack }),
    },
  });
}

module.exports = { notFound, errorHandler };
