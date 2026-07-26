import { Router } from "express";
import {
  authenticateToken,
  authorizeRoles,
} from "../middleware/authMiddleware.js";
import {
  adjustCitizenPoints,
  createInfraction,
  getCitizenDetails,
  listCitizens,
  listInfractions,
  listVehicles,
  updateInfractionStatus,
  updateLicenseStatus,
} from "../services/trafficService.js";
import {
  validateInfractionPayload,
  validateInfractionStatusPayload,
  validateLicenseStatusPayload,
  validatePointAdjustmentPayload,
} from "../utils/validateTraffic.js";

export const adminRouter = Router();

adminRouter.use(authenticateToken, authorizeRoles("admin"));

function sendValidationErrors(res, errors) {
  return res.status(400).json({ message: "Datos inválidos.", errors });
}

adminRouter.get("/citizens", async (req, res, next) => {
  try {
    res.json(await listCitizens(req.query.search));
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/citizens/:citizenId", async (req, res, next) => {
  try {
    res.json(await getCitizenDetails(req.params.citizenId));
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/vehicles", async (req, res, next) => {
  try {
    res.json(await listVehicles(req.query));
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/infractions", async (req, res, next) => {
  try {
    res.json(await listInfractions(req.query));
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/infractions", async (req, res, next) => {
  try {
    const errors = validateInfractionPayload(req.body);
    if (errors.length) return sendValidationErrors(res, errors);

    res.status(201).json(await createInfraction(req.body, req.user));
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/infractions/:infractionId/status", async (req, res, next) => {
  try {
    const errors = validateInfractionStatusPayload(req.body);
    if (errors.length) return sendValidationErrors(res, errors);

    res.json(
      await updateInfractionStatus(req.params.infractionId, req.body, req.user)
    );
  } catch (error) {
    next(error);
  }
});

adminRouter.post(
  "/citizens/:citizenId/point-adjustments",
  async (req, res, next) => {
    try {
      const errors = validatePointAdjustmentPayload(req.body);
      if (errors.length) return sendValidationErrors(res, errors);

      res.status(201).json(
        await adjustCitizenPoints(req.params.citizenId, req.body, req.user)
      );
    } catch (error) {
      next(error);
    }
  }
);

adminRouter.patch(
  "/citizens/:citizenId/licenses/:licenseId/status",
  async (req, res, next) => {
    try {
      const errors = validateLicenseStatusPayload(req.body);
      if (errors.length) return sendValidationErrors(res, errors);

      res.json(
        await updateLicenseStatus(
          req.params.citizenId,
          req.params.licenseId,
          req.body,
          req.user
        )
      );
    } catch (error) {
      next(error);
    }
  }
);
