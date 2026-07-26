import express from "express";
import cors from "cors";
import morgan from "morgan";
import { authRouter } from "./routes/authRoutes.js";
import { healthRouter } from "./routes/healthRoutes.js";
import { meRouter } from "./routes/meRoutes.js";
import { adminRouter } from "./routes/adminRoutes.js";
import { registerSwagger } from "./docs/swagger.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";

export const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
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
