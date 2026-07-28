import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { registerSwagger } from "./docs/swagger.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";
import { adminRouter } from "./routes/adminRoutes.js";
import { authRouter } from "./routes/authRoutes.js";
import { healthRouter } from "./routes/healthRoutes.js";
import { meRouter } from "./routes/meRoutes.js";

export const app = express();

const allowedOrigins = String(
  process.env.FRONTEND_URLS ||
    process.env.FRONTEND_URL ||
    "http://localhost:5173"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      const error = new Error("Origen no permitido por CORS.");
      error.status = 403;
      return callback(error);
    },
  })
);
app.use(express.json());
app.use(morgan("dev"));

registerSwagger(app);
app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/me", meRouter);
app.use("/api/admin", adminRouter);

app.use(notFound);
app.use(errorHandler);
