import { Router } from "express";
import jwt from "jsonwebtoken";
import { authUsers } from "../data/authUsers.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

export const authRouter = Router();

authRouter.post("/login", (req, res) => {
  const { email, password } = req.body ?? {};

  const foundUser = authUsers.find(
    (user) =>
      user.email.toLowerCase() === String(email).trim().toLowerCase() &&
      user.password === password
  );

  if (!foundUser) {
    return res.status(401).json({ message: "Credenciales incorrectas." });
  }

  const userToSend = {
    id: foundUser.id,
    name: foundUser.name,
    email: foundUser.email,
    role: foundUser.role,
    citizenId: foundUser.citizenId,
  };

  const token = jwt.sign(userToSend, process.env.JWT_SECRET, {
    expiresIn: "2h",
  });

  res.json({
    token,
    user: userToSend,
  });
});

authRouter.get("/me", authenticateToken, (req, res) => {
  res.json({ user: req.user });
});
