import { Router } from "express";
import {
  authenticateToken,
  authorizeRoles,
} from "../middleware/authMiddleware.js";
import { getCitizenDetails } from "../services/trafficService.js";

export const meRouter = Router();

meRouter.use(authenticateToken, authorizeRoles("citizen"));

meRouter.get("/", async (req, res, next) => {
  try {
    res.json(await getCitizenDetails(req.user.citizenId));
  } catch (error) {
    next(error);
  }
});

for (const resource of [
  "profile",
  "vehicles",
  "licenses",
  "infractions",
  "pointMovements",
  "summary",
]) {
  meRouter.get(`/${resource}`, async (req, res, next) => {
    try {
      const details = await getCitizenDetails(req.user.citizenId);
      res.json(details[resource]);
    } catch (error) {
      next(error);
    }
  });
}
