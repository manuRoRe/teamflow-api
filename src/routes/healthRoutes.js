import { Router } from "express";

export const healthRouter = Router();

healthRouter.get("/", (req, res) => {
  res.json({
    status: "ok",
    app: "Mi Tráfico API",
    timestamp: new Date().toISOString(),
  });
});
