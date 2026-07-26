export function notFound(req, res) {
  res.status(404).json({
    message: "Endpoint no encontrado.",
    path: req.originalUrl,
  });
}
