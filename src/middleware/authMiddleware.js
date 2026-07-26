import jwt from "jsonwebtoken";

export function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Token no enviado." });
  }

  try {
    const decodedUser = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decodedUser;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Token inválido o expirado." });
  }
}

export function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Usuario no autenticado." });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: "No tienes permisos para realizar esta acción.",
      });
    }

    next();
  };
}
