import { Router } from "express";
import { getDatabase } from "../database/client.js";

export const healthRouter = Router();

healthRouter.get("/", async (req, res) => {
  try {
    await getDatabase().$queryRaw`SELECT 1`;
    res.json({
      status: "ok",
      database: "connected",
      app: "Mi Tráfico API",
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.status(503).json({
      status: "error",
      database: "unavailable",
      app: "Mi Tráfico API",
      timestamp: new Date().toISOString(),
    });
  }
});
