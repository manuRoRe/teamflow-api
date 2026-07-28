import { hash } from "bcryptjs";
import { readFile } from "node:fs/promises";

const seedFileUrl = new URL("../../prisma/seed-data.json", import.meta.url);

function asDate(value) {
  return new Date(`${value}T00:00:00.000Z`);
}

export async function seedDatabase(database) {
  if ((await database.user.count()) > 0) {
    return { seeded: false };
  }

  const store = JSON.parse(await readFile(seedFileUrl, "utf-8"));
  const adminPasswordHash = await hash("admin123", 12);
  const citizenPasswordHash = await hash("user123", 12);

  return database.$transaction(async (tx) => {
    const admin = await tx.user.create({
      data: {
        name: "Agente Administrador",
        email: "agente@trafico.test",
        passwordHash: adminPasswordHash,
        role: "admin",
      },
    });

    const citizenUsers = new Map([
      [1, { email: "laura@trafico.test", passwordHash: citizenPasswordHash }],
      [2, { email: "diego@trafico.test", passwordHash: citizenPasswordHash }],
    ]);
    const citizenIdMap = new Map();

    for (const sourceCitizen of store.citizens) {
      const credentials = citizenUsers.get(sourceCitizen.id);
      const user = await tx.user.create({
        data: {
          name: sourceCitizen.name,
          email: credentials.email,
          passwordHash: credentials.passwordHash,
          role: "citizen",
          citizen: {
            create: {
              dni: sourceCitizen.dni,
              birthDate: asDate(sourceCitizen.birthDate),
              street: sourceCitizen.address.street,
              postalCode: sourceCitizen.address.postalCode,
              city: sourceCitizen.address.city,
              province: sourceCitizen.address.province,
              phone: sourceCitizen.phone,
              points: sourceCitizen.points,
              pointsUpdatedAt: new Date(sourceCitizen.pointsUpdatedAt),
              createdByUserId: admin.id,
            },
          },
        },
        include: { citizen: true },
      });

      citizenIdMap.set(sourceCitizen.id, user.citizen.id);
    }

    const vehicleIdMap = new Map();
    for (const sourceVehicle of store.vehicles) {
      const vehicle = await tx.vehicle.create({
        data: {
          ownerCitizenId: citizenIdMap.get(sourceVehicle.ownerCitizenId),
          registrationPlate: sourceVehicle.registrationPlate,
          vin: sourceVehicle.vin,
          make: sourceVehicle.make,
          model: sourceVehicle.model,
          year: sourceVehicle.year,
          fuel: sourceVehicle.fuel,
          inspectionValidUntil: sourceVehicle.inspectionValidUntil
            ? asDate(sourceVehicle.inspectionValidUntil)
            : null,
          insuranceValidUntil: sourceVehicle.insuranceValidUntil
            ? asDate(sourceVehicle.insuranceValidUntil)
            : null,
          status: sourceVehicle.status,
        },
      });
      vehicleIdMap.set(sourceVehicle.id, vehicle.id);
    }

    for (const sourceLicense of store.licenses) {
      await tx.drivingLicense.create({
        data: {
          citizenId: citizenIdMap.get(sourceLicense.citizenId),
          category: sourceLicense.category,
          licenseNumber: sourceLicense.licenseNumber,
          issuedAt: asDate(sourceLicense.issuedAt),
          expiresAt: asDate(sourceLicense.expiresAt),
          status: sourceLicense.status,
          statusReason: sourceLicense.statusReason,
          statusChangedAt: new Date(sourceLicense.statusChangedAt),
        },
      });
    }

    const infractionIdMap = new Map();
    for (const sourceInfraction of store.infractions) {
      const infraction = await tx.infraction.create({
        data: {
          reference: sourceInfraction.reference,
          citizenId: citizenIdMap.get(sourceInfraction.citizenId),
          vehicleId: sourceInfraction.vehicleId
            ? vehicleIdMap.get(sourceInfraction.vehicleId)
            : null,
          code: sourceInfraction.code,
          description: sourceInfraction.description,
          occurredAt: new Date(sourceInfraction.occurredAt),
          location: sourceInfraction.location,
          pointsDeducted: sourceInfraction.pointsDeducted,
          fineAmount: sourceInfraction.fineAmount,
          status: sourceInfraction.status,
          notes: sourceInfraction.notes,
          pointsBefore: sourceInfraction.pointsBefore,
          pointsAfter: sourceInfraction.pointsAfter,
          createdAt: new Date(sourceInfraction.createdAt),
          recordedByUserId: admin.id,
          statusChangedAt: sourceInfraction.statusChangedAt
            ? new Date(sourceInfraction.statusChangedAt)
            : null,
          statusReason: sourceInfraction.statusReason ?? "",
          statusChangedByUserId: sourceInfraction.statusChangedAt ? admin.id : null,
        },
      });
      infractionIdMap.set(sourceInfraction.id, infraction.id);
    }

    for (const sourceMovement of store.pointMovements) {
      await tx.pointMovement.create({
        data: {
          citizenId: citizenIdMap.get(sourceMovement.citizenId),
          type: sourceMovement.type,
          delta: sourceMovement.delta,
          balanceBefore: sourceMovement.balanceBefore,
          balanceAfter: sourceMovement.balanceAfter,
          reason: sourceMovement.reason,
          infractionId: sourceMovement.infractionId
            ? infractionIdMap.get(sourceMovement.infractionId)
            : null,
          createdAt: new Date(sourceMovement.createdAt),
          recordedByUserId: admin.id,
        },
      });
    }

    return { seeded: true };
  });
}
