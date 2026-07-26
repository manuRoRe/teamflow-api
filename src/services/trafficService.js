import {
  mutateTrafficStore,
  readTrafficStore,
} from "../repositories/trafficRepository.js";
import { httpError } from "../utils/httpError.js";

const MAX_POINTS = 15;

function nextId(collection) {
  return collection.length === 0
    ? 1
    : Math.max(...collection.map((item) => item.id)) + 1;
}

function findCitizen(store, citizenId) {
  const citizen = store.citizens.find((item) => item.id === Number(citizenId));

  if (!citizen) {
    throw httpError(404, "Ciudadano no encontrado.");
  }

  return citizen;
}

function publicCitizen(citizen) {
  const { id, dni, name, birthDate, address, email, phone, points, pointsUpdatedAt } =
    citizen;
  return { id, dni, name, birthDate, address, email, phone, points, pointsUpdatedAt };
}

function buildCitizenDetails(store, citizenId) {
  const citizen = findCitizen(store, citizenId);
  const vehicles = store.vehicles.filter(
    (vehicle) => vehicle.ownerCitizenId === citizen.id
  );
  const licenses = store.licenses.filter(
    (license) => license.citizenId === citizen.id
  );
  const infractions = store.infractions
    .filter((infraction) => infraction.citizenId === citizen.id)
    .sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));
  const pointMovements = store.pointMovements
    .filter((movement) => movement.citizenId === citizen.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return {
    profile: publicCitizen(citizen),
    vehicles,
    licenses,
    infractions,
    pointMovements,
    summary: {
      currentPoints: citizen.points,
      vehicleCount: vehicles.length,
      activeLicenseCategories: licenses
        .filter((license) => license.status === "active")
        .map((license) => license.category),
      pendingInfractions: infractions.filter(
        (infraction) => infraction.status === "pending"
      ).length,
      pendingFineAmount: infractions
        .filter((infraction) => infraction.status === "pending")
        .reduce((total, infraction) => total + infraction.fineAmount, 0),
      canDrive:
        citizen.points > 0 &&
        licenses.some((license) => license.status === "active"),
    },
  };
}

export async function getCitizenDetails(citizenId) {
  const store = await readTrafficStore();
  return buildCitizenDetails(store, citizenId);
}

export async function listCitizens(search) {
  const store = await readTrafficStore();
  const normalizedSearch = search?.trim().toLowerCase();

  return store.citizens
    .filter((citizen) => {
      if (!normalizedSearch) return true;
      return (
        citizen.name.toLowerCase().includes(normalizedSearch) ||
        citizen.dni.toLowerCase().includes(normalizedSearch) ||
        citizen.email.toLowerCase().includes(normalizedSearch)
      );
    })
    .map(publicCitizen);
}

export async function listInfractions(filters = {}) {
  const store = await readTrafficStore();

  return store.infractions
    .filter((infraction) => {
      if (filters.citizenId && infraction.citizenId !== Number(filters.citizenId)) {
        return false;
      }
      if (filters.vehicleId && infraction.vehicleId !== Number(filters.vehicleId)) {
        return false;
      }
      if (filters.status && infraction.status !== filters.status) {
        return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function listVehicles(filters = {}) {
  const store = await readTrafficStore();
  const plate = filters.registrationPlate?.trim().toUpperCase();

  return store.vehicles.filter((vehicle) => {
    if (filters.citizenId && vehicle.ownerCitizenId !== Number(filters.citizenId)) {
      return false;
    }
    if (plate && !vehicle.registrationPlate.toUpperCase().includes(plate)) {
      return false;
    }
    return true;
  });
}

export async function createInfraction(payload, agent) {
  return mutateTrafficStore((store) => {
    const citizen = findCitizen(store, payload.citizenId);
    const vehicleId =
      payload.vehicleId === undefined || payload.vehicleId === null
        ? null
        : Number(payload.vehicleId);

    if (vehicleId !== null) {
      const vehicle = store.vehicles.find((item) => item.id === vehicleId);

      if (!vehicle) {
        throw httpError(404, "Vehículo no encontrado.");
      }

      if (vehicle.ownerCitizenId !== citizen.id) {
        throw httpError(
          409,
          "El vehículo indicado no pertenece al ciudadano sancionado."
        );
      }
    }

    const requestedPoints = Number(payload.pointsToDeduct);
    const pointsDeducted = Math.min(requestedPoints, citizen.points);
    const pointsBefore = citizen.points;
    const pointsAfter = pointsBefore - pointsDeducted;
    const createdAt = new Date().toISOString();
    const id = nextId(store.infractions);

    const infraction = {
      id,
      reference: `INF-${new Date(createdAt).getUTCFullYear()}-${String(id).padStart(
        5,
        "0"
      )}`,
      citizenId: citizen.id,
      vehicleId,
      code: String(payload.code).trim().toUpperCase(),
      description: String(payload.description).trim(),
      occurredAt: new Date(payload.occurredAt).toISOString(),
      location: String(payload.location).trim(),
      pointsDeducted,
      fineAmount: Number(payload.fineAmount),
      status: "pending",
      notes: payload.notes ? String(payload.notes).trim() : "",
      pointsBefore,
      pointsAfter,
      createdAt,
      recordedBy: {
        userId: agent.id,
        name: agent.name,
      },
    };

    store.infractions.push(infraction);

    if (pointsDeducted > 0) {
      citizen.points = pointsAfter;
      citizen.pointsUpdatedAt = createdAt;
      store.pointMovements.push({
        id: nextId(store.pointMovements),
        citizenId: citizen.id,
        type: "infraction",
        delta: -pointsDeducted,
        balanceBefore: pointsBefore,
        balanceAfter: pointsAfter,
        reason: `${infraction.reference}: ${infraction.description}`,
        infractionId: id,
        createdAt,
        recordedBy: infraction.recordedBy,
      });
    }

    return infraction;
  });
}

export async function adjustCitizenPoints(citizenId, payload, agent) {
  return mutateTrafficStore((store) => {
    const citizen = findCitizen(store, citizenId);
    const requestedDelta = Number(payload.delta);
    const balanceBefore = citizen.points;
    const balanceAfter = Math.min(
      MAX_POINTS,
      Math.max(0, balanceBefore + requestedDelta)
    );
    const appliedDelta = balanceAfter - balanceBefore;

    if (appliedDelta === 0) {
      throw httpError(
        409,
        `El saldo ya está en el límite permitido (0-${MAX_POINTS} puntos).`
      );
    }

    const createdAt = new Date().toISOString();
    const movement = {
      id: nextId(store.pointMovements),
      citizenId: citizen.id,
      type: "manual_adjustment",
      delta: appliedDelta,
      requestedDelta,
      balanceBefore,
      balanceAfter,
      reason: String(payload.reason).trim(),
      infractionId: null,
      createdAt,
      recordedBy: {
        userId: agent.id,
        name: agent.name,
      },
    };

    citizen.points = balanceAfter;
    citizen.pointsUpdatedAt = createdAt;
    store.pointMovements.push(movement);

    return movement;
  });
}

export async function updateLicenseStatus(citizenId, licenseId, payload, agent) {
  return mutateTrafficStore((store) => {
    const citizen = findCitizen(store, citizenId);
    const license = store.licenses.find(
      (item) => item.id === Number(licenseId) && item.citizenId === citizen.id
    );

    if (!license) {
      throw httpError(404, "Permiso de conducción no encontrado para ese ciudadano.");
    }

    if (license.status === payload.status) {
      throw httpError(409, `El permiso ya tiene el estado '${payload.status}'.`);
    }

    const changedAt = payload.effectiveAt
      ? new Date(payload.effectiveAt).toISOString()
      : new Date().toISOString();
    const previousStatus = license.status;
    license.status = payload.status;
    license.statusReason = payload.reason?.trim() || "";
    license.statusChangedAt = changedAt;
    license.statusHistory ??= [];
    license.statusHistory.push({
      from: previousStatus,
      to: payload.status,
      reason: license.statusReason,
      changedAt,
      recordedBy: {
        userId: agent.id,
        name: agent.name,
      },
    });

    return license;
  });
}

export async function updateInfractionStatus(infractionId, payload, agent) {
  return mutateTrafficStore((store) => {
    const infraction = store.infractions.find(
      (item) => item.id === Number(infractionId)
    );

    if (!infraction) {
      throw httpError(404, "Infracción no encontrada.");
    }

    if (infraction.status === payload.status) {
      throw httpError(409, `La infracción ya tiene el estado '${payload.status}'.`);
    }

    if (infraction.status === "cancelled") {
      throw httpError(409, "Una infracción anulada no puede cambiar de estado.");
    }

    const previousStatus = infraction.status;
    const changedAt = new Date().toISOString();
    infraction.status = payload.status;
    infraction.statusChangedAt = changedAt;
    infraction.statusReason = payload.reason?.trim() || "";
    infraction.statusChangedBy = { userId: agent.id, name: agent.name };

    if (payload.status === "cancelled" && infraction.pointsDeducted > 0) {
      const citizen = findCitizen(store, infraction.citizenId);
      const balanceBefore = citizen.points;
      const balanceAfter = Math.min(
        MAX_POINTS,
        balanceBefore + infraction.pointsDeducted
      );
      const restoredPoints = balanceAfter - balanceBefore;

      citizen.points = balanceAfter;
      citizen.pointsUpdatedAt = changedAt;
      store.pointMovements.push({
        id: nextId(store.pointMovements),
        citizenId: citizen.id,
        type: "infraction_cancelled",
        delta: restoredPoints,
        balanceBefore,
        balanceAfter,
        reason: `Anulación de ${infraction.reference}: ${infraction.statusReason}`,
        infractionId: infraction.id,
        createdAt: changedAt,
        recordedBy: infraction.statusChangedBy,
      });
    }

    return { ...infraction, previousStatus };
  });
}
