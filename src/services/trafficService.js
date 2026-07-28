import { hash } from "bcryptjs";
import { randomUUID } from "node:crypto";
import { getDatabase } from "../database/client.js";
import { httpError } from "../utils/httpError.js";

const MAX_POINTS = 15;
const recordedBySelect = { id: true, name: true };

const detailsInclude = {
  user: { select: { name: true, email: true } },
  vehicles: { orderBy: { id: "asc" } },
  licenses: {
    orderBy: { id: "asc" },
    include: {
      statusHistory: {
        orderBy: { changedAt: "asc" },
      },
    },
  },
  infractions: {
    orderBy: { occurredAt: "desc" },
  },
  pointMovements: {
    orderBy: { createdAt: "desc" },
  },
};

function asIso(value) {
  return value ? new Date(value).toISOString() : null;
}

function asDateOnly(value) {
  return value ? asIso(value).slice(0, 10) : null;
}

function mapRecordedBy(user) {
  return user ? { userId: user.id, name: user.name } : undefined;
}

function mapCitizen(citizen) {
  return {
    id: citizen.id,
    dni: citizen.dni,
    name: citizen.user.name,
    birthDate: asDateOnly(citizen.birthDate),
    address: {
      street: citizen.street,
      postalCode: citizen.postalCode,
      city: citizen.city,
      province: citizen.province,
    },
    email: citizen.user.email,
    phone: citizen.phone,
    points: citizen.points,
    pointsUpdatedAt: asIso(citizen.pointsUpdatedAt),
  };
}

function mapVehicle(vehicle) {
  return {
    id: vehicle.id,
    ownerCitizenId: vehicle.ownerCitizenId,
    registrationPlate: vehicle.registrationPlate,
    vin: vehicle.vin,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
    fuel: vehicle.fuel,
    inspectionValidUntil: asDateOnly(vehicle.inspectionValidUntil),
    insuranceValidUntil: asDateOnly(vehicle.insuranceValidUntil),
    status: vehicle.status,
  };
}

function mapLicense(license) {
  return {
    id: license.id,
    citizenId: license.citizenId,
    category: license.category,
    licenseNumber: license.licenseNumber,
    issuedAt: asDateOnly(license.issuedAt),
    expiresAt: asDateOnly(license.expiresAt),
    status: license.status,
    statusReason: license.statusReason,
    statusChangedAt: asIso(license.statusChangedAt),
    statusHistory: (license.statusHistory ?? []).map((entry) => ({
      from: entry.fromStatus,
      to: entry.toStatus,
      reason: entry.reason,
      changedAt: asIso(entry.changedAt),
      recordedBy: mapRecordedBy(entry.recordedBy),
    })),
  };
}

function mapInfraction(infraction) {
  return {
    id: infraction.id,
    reference: infraction.reference,
    citizenId: infraction.citizenId,
    vehicleId: infraction.vehicleId,
    code: infraction.code,
    description: infraction.description,
    occurredAt: asIso(infraction.occurredAt),
    location: infraction.location,
    pointsDeducted: infraction.pointsDeducted,
    fineAmount: Number(infraction.fineAmount),
    status: infraction.status,
    notes: infraction.notes,
    pointsBefore: infraction.pointsBefore,
    pointsAfter: infraction.pointsAfter,
    createdAt: asIso(infraction.createdAt),
    recordedBy: mapRecordedBy(infraction.recordedBy),
    ...(infraction.statusChangedAt
      ? {
          statusChangedAt: asIso(infraction.statusChangedAt),
          statusReason: infraction.statusReason,
          statusChangedBy: mapRecordedBy(infraction.statusChangedBy),
        }
      : {}),
  };
}

function mapPointMovement(movement) {
  return {
    id: movement.id,
    citizenId: movement.citizenId,
    type: movement.type,
    delta: movement.delta,
    ...(movement.requestedDelta !== null
      ? { requestedDelta: movement.requestedDelta }
      : {}),
    balanceBefore: movement.balanceBefore,
    balanceAfter: movement.balanceAfter,
    reason: movement.reason,
    infractionId: movement.infractionId,
    createdAt: asIso(movement.createdAt),
    recordedBy: mapRecordedBy(movement.recordedBy),
  };
}

function buildCitizenDetails(citizen) {
  const vehicles = citizen.vehicles.map(mapVehicle);
  const licenses = citizen.licenses.map(mapLicense);
  const infractions = citizen.infractions.map(mapInfraction);
  const pointMovements = citizen.pointMovements.map(mapPointMovement);

  return {
    profile: mapCitizen(citizen),
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

async function findCitizenOrThrow(database, citizenId, include = undefined) {
  const citizen = await database.citizen.findUnique({
    where: { id: Number(citizenId) },
    ...(include ? { include } : {}),
  });

  if (!citizen) {
    throw httpError(404, "Ciudadano no encontrado.");
  }

  return citizen;
}

export async function getCitizenDetails(citizenId) {
  const database = getDatabase();
  const citizen = await findCitizenOrThrow(database, citizenId, detailsInclude);
  const recorderIds = [
    ...new Set(
      [
        ...citizen.pointMovements.map(
          (movement) => movement.recordedByUserId
        ),
        ...citizen.infractions.flatMap((infraction) => [
          infraction.recordedByUserId,
          infraction.statusChangedByUserId,
        ]),
        ...citizen.licenses.flatMap((license) =>
          license.statusHistory.map((entry) => entry.recordedByUserId)
        ),
      ].filter((id) => id != null)
    ),
  ];
  const recorders = recorderIds.length
    ? await database.user.findMany({
        where: { id: { in: recorderIds } },
        select: recordedBySelect,
      })
    : [];
  const recorderById = new Map(recorders.map((user) => [user.id, user]));
  citizen.pointMovements = citizen.pointMovements.map((movement) => ({
    ...movement,
    recordedBy: recorderById.get(movement.recordedByUserId),
  }));
  citizen.infractions = citizen.infractions.map((infraction) => ({
    ...infraction,
    recordedBy: recorderById.get(infraction.recordedByUserId),
    statusChangedBy: recorderById.get(infraction.statusChangedByUserId),
  }));
  citizen.licenses = citizen.licenses.map((license) => ({
    ...license,
    statusHistory: license.statusHistory.map((entry) => ({
      ...entry,
      recordedBy: recorderById.get(entry.recordedByUserId),
    })),
  }));

  return buildCitizenDetails(citizen);
}

export async function listCitizens(search) {
  const normalizedSearch = search?.trim();
  const citizens = await getDatabase().citizen.findMany({
    where: normalizedSearch
      ? {
          OR: [
            { dni: { contains: normalizedSearch, mode: "insensitive" } },
            {
              user: {
                name: { contains: normalizedSearch, mode: "insensitive" },
              },
            },
            {
              user: {
                email: { contains: normalizedSearch, mode: "insensitive" },
              },
            },
          ],
        }
      : undefined,
    include: { user: { select: { name: true, email: true } } },
    orderBy: { id: "asc" },
  });

  return citizens.map(mapCitizen);
}

export async function listInfractions(filters = {}) {
  const infractions = await getDatabase().infraction.findMany({
    where: {
      ...(filters.citizenId ? { citizenId: Number(filters.citizenId) } : {}),
      ...(filters.vehicleId ? { vehicleId: Number(filters.vehicleId) } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    },
    include: {
      recordedBy: { select: recordedBySelect },
      statusChangedBy: { select: recordedBySelect },
    },
    orderBy: { createdAt: "desc" },
  });

  return infractions.map(mapInfraction);
}

export async function listVehicles(filters = {}) {
  const vehicles = await getDatabase().vehicle.findMany({
    where: {
      ...(filters.citizenId
        ? { ownerCitizenId: Number(filters.citizenId) }
        : {}),
      ...(filters.registrationPlate
        ? {
            registrationPlate: {
              contains: filters.registrationPlate.trim(),
              mode: "insensitive",
            },
          }
        : {}),
    },
    orderBy: { id: "asc" },
  });

  return vehicles.map(mapVehicle);
}

export async function createCitizen(payload, agent) {
  const database = getDatabase();
  const passwordHash = await hash(String(payload.password), 12);
  const email = String(payload.email).trim().toLowerCase();
  const dni = String(payload.dni).trim().toUpperCase();

  try {
    const created = await database.user.create({
      data: {
        name: String(payload.name).trim(),
        email,
        passwordHash,
        role: "citizen",
        citizen: {
          create: {
            dni,
            birthDate: new Date(`${payload.birthDate}T00:00:00.000Z`),
            street: String(payload.address.street).trim(),
            postalCode: String(payload.address.postalCode).trim(),
            city: String(payload.address.city).trim(),
            province: String(payload.address.province).trim(),
            phone: String(payload.phone).trim(),
            points: Number(payload.initialPoints),
            pointsUpdatedAt: new Date(),
            createdByUserId: agent.id,
          },
        },
      },
      include: {
        citizen: true,
      },
    });

    return {
      user: {
        id: created.id,
        name: created.name,
        email: created.email,
        role: created.role,
        citizenId: created.citizen.id,
      },
      citizen: mapCitizen({
        ...created.citizen,
        user: { name: created.name, email: created.email },
      }),
    };
  } catch (error) {
    if (error.code === "P2002" || error.code === "23505") {
      const fields = Array.isArray(error.meta?.target)
        ? error.meta.target.join(", ")
        : "email o DNI";
      throw httpError(409, `Ya existe un registro con el mismo ${fields}.`);
    }
    throw error;
  }
}

export async function createInfraction(payload, agent) {
  const database = getDatabase();

  return database.$transaction(async (tx) => {
    const citizen = await findCitizenOrThrow(tx, payload.citizenId);
    const vehicleId =
      payload.vehicleId === undefined || payload.vehicleId === null
        ? null
        : Number(payload.vehicleId);

    if (vehicleId !== null) {
      const vehicle = await tx.vehicle.findUnique({ where: { id: vehicleId } });
      if (!vehicle) throw httpError(404, "Vehículo no encontrado.");
      if (vehicle.ownerCitizenId !== citizen.id) {
        throw httpError(
          409,
          "El vehículo indicado no pertenece al ciudadano sancionado."
        );
      }
    }

    const pointsDeducted = Math.min(
      Number(payload.pointsToDeduct),
      citizen.points
    );
    const pointsAfter = citizen.points - pointsDeducted;
    const createdAt = new Date();
    const pendingReference = `TMP-${randomUUID()
      .replaceAll("-", "")
      .slice(0, 20)}`;

    let infraction = await tx.infraction.create({
      data: {
        reference: pendingReference,
        citizenId: citizen.id,
        vehicleId,
        code: String(payload.code).trim().toUpperCase(),
        description: String(payload.description).trim(),
        occurredAt: new Date(payload.occurredAt),
        location: String(payload.location).trim(),
        pointsDeducted,
        fineAmount: Number(payload.fineAmount),
        status: "pending",
        notes: payload.notes ? String(payload.notes).trim() : "",
        pointsBefore: citizen.points,
        pointsAfter,
        createdAt,
        recordedByUserId: agent.id,
      },
    });

    const reference = `INF-${createdAt.getUTCFullYear()}-${String(
      infraction.id
    ).padStart(5, "0")}`;
    infraction = await tx.infraction.update({
      where: { id: infraction.id },
      data: { reference },
      include: { recordedBy: { select: recordedBySelect } },
    });

    if (pointsDeducted > 0) {
      await tx.citizen.update({
        where: { id: citizen.id },
        data: { points: pointsAfter, pointsUpdatedAt: createdAt },
      });
      await tx.pointMovement.create({
        data: {
          citizenId: citizen.id,
          type: "infraction",
          delta: -pointsDeducted,
          balanceBefore: citizen.points,
          balanceAfter: pointsAfter,
          reason: `${reference}: ${infraction.description}`,
          infractionId: infraction.id,
          createdAt,
          recordedByUserId: agent.id,
        },
      });
    }

    return mapInfraction(infraction);
  });
}

export async function adjustCitizenPoints(citizenId, payload, agent) {
  return getDatabase().$transaction(async (tx) => {
    const citizen = await findCitizenOrThrow(tx, citizenId);
    const requestedDelta = Number(payload.delta);
    const balanceAfter = Math.min(
      MAX_POINTS,
      Math.max(0, citizen.points + requestedDelta)
    );
    const appliedDelta = balanceAfter - citizen.points;

    if (appliedDelta === 0) {
      throw httpError(
        409,
        `El saldo ya está en el límite permitido (0-${MAX_POINTS} puntos).`
      );
    }

    const createdAt = new Date();
    await tx.citizen.update({
      where: { id: citizen.id },
      data: { points: balanceAfter, pointsUpdatedAt: createdAt },
    });
    const movement = await tx.pointMovement.create({
      data: {
        citizenId: citizen.id,
        type: "manual_adjustment",
        delta: appliedDelta,
        requestedDelta,
        balanceBefore: citizen.points,
        balanceAfter,
        reason: String(payload.reason).trim(),
        createdAt,
        recordedByUserId: agent.id,
      },
      include: { recordedBy: { select: recordedBySelect } },
    });

    return mapPointMovement(movement);
  });
}

export async function updateLicenseStatus(citizenId, licenseId, payload, agent) {
  return getDatabase().$transaction(async (tx) => {
    await findCitizenOrThrow(tx, citizenId);
    const license = await tx.drivingLicense.findFirst({
      where: { id: Number(licenseId), citizenId: Number(citizenId) },
    });

    if (!license) {
      throw httpError(
        404,
        "Permiso de conducción no encontrado para ese ciudadano."
      );
    }
    if (license.status === payload.status) {
      throw httpError(409, `El permiso ya tiene el estado '${payload.status}'.`);
    }

    const changedAt = payload.effectiveAt
      ? new Date(payload.effectiveAt)
      : new Date();
    const reason = payload.reason?.trim() || "";

    const updated = await tx.drivingLicense.update({
      where: { id: license.id },
      data: {
        status: payload.status,
        statusReason: reason,
        statusChangedAt: changedAt,
        statusHistory: {
          create: {
            fromStatus: license.status,
            toStatus: payload.status,
            reason,
            changedAt,
            recordedByUserId: agent.id,
          },
        },
      },
      include: {
        statusHistory: {
          orderBy: { changedAt: "asc" },
          include: { recordedBy: { select: recordedBySelect } },
        },
      },
    });

    return mapLicense(updated);
  });
}

export async function updateInfractionStatus(infractionId, payload, agent) {
  return getDatabase().$transaction(async (tx) => {
    const infraction = await tx.infraction.findUnique({
      where: { id: Number(infractionId) },
    });

    if (!infraction) throw httpError(404, "Infracción no encontrada.");
    if (infraction.status === payload.status) {
      throw httpError(
        409,
        `La infracción ya tiene el estado '${payload.status}'.`
      );
    }
    if (infraction.status === "cancelled") {
      throw httpError(409, "Una infracción anulada no puede cambiar de estado.");
    }

    const previousStatus = infraction.status;
    const changedAt = new Date();
    const reason = payload.reason?.trim() || "";

    if (payload.status === "cancelled" && infraction.pointsDeducted > 0) {
      const citizen = await findCitizenOrThrow(tx, infraction.citizenId);
      const balanceAfter = Math.min(
        MAX_POINTS,
        citizen.points + infraction.pointsDeducted
      );
      const restoredPoints = balanceAfter - citizen.points;

      if (restoredPoints > 0) {
        await tx.citizen.update({
          where: { id: citizen.id },
          data: { points: balanceAfter, pointsUpdatedAt: changedAt },
        });
        await tx.pointMovement.create({
          data: {
            citizenId: citizen.id,
            type: "infraction_cancelled",
            delta: restoredPoints,
            balanceBefore: citizen.points,
            balanceAfter,
            reason: `Anulación de ${infraction.reference}: ${reason}`,
            infractionId: infraction.id,
            createdAt: changedAt,
            recordedByUserId: agent.id,
          },
        });
      }
    }

    const updated = await tx.infraction.update({
      where: { id: infraction.id },
      data: {
        status: payload.status,
        statusChangedAt: changedAt,
        statusReason: reason,
        statusChangedByUserId: agent.id,
      },
      include: {
        recordedBy: { select: recordedBySelect },
        statusChangedBy: { select: recordedBySelect },
      },
    });

    return { ...mapInfraction(updated), previousStatus };
  });
}
