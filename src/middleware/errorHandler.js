export function errorHandler(error, req, res, next) {
  if (!error.status || error.status >= 500) {
    console.error(error);
  }

  res.status(error.status || 500).json({
    message: error.message || "Error interno del servidor.",
    ...(error.details ? { details: error.details } : {}),
  });
}
