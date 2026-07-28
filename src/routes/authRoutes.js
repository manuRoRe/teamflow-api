import { compare } from "bcryptjs";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import { getDatabase } from "../database/client.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

export const authRouter = Router();

const configuredLoginLimit = Number.parseInt(
  process.env.LOGIN_RATE_LIMIT ?? "",
  10
);
const loginLimit =
  Number.isInteger(configuredLoginLimit) && configuredLoginLimit > 0
    ? configuredLoginLimit
    : 100;

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: loginLimit,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  message: {
    message: "Demasiados intentos de inicio de sesión. Inténtalo más tarde.",
  },
});

authRouter.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};
    const normalizedEmail = String(email ?? "").trim().toLowerCase();
    const foundUser = normalizedEmail
      ? await getDatabase().user.findUnique({
          where: { email: normalizedEmail },
          include: { citizen: { select: { id: true } } },
        })
      : null;

    if (
      !foundUser ||
      typeof password !== "string" ||
      !(await compare(password, foundUser.passwordHash))
    ) {
      return res.status(401).json({ message: "Credenciales incorrectas." });
    }

    const userToSend = {
      id: foundUser.id,
      name: foundUser.name,
      email: foundUser.email,
      role: foundUser.role,
      citizenId: foundUser.citizen?.id ?? null,
    };
    const token = jwt.sign(userToSend, process.env.JWT_SECRET, {
      expiresIn: "2h",
    });

    res.json({ token, user: userToSend });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", authenticateToken, (req, res) => {
  res.json({ user: req.user });
});
