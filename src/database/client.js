import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

let databaseClient;

export function createDatabaseClient(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error("DATABASE_URL no está configurada.");
  }

  const adapter = new PrismaPg({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
  });

  return new PrismaClient({ adapter });
}

export function getDatabase() {
  databaseClient ??= createDatabaseClient();
  return databaseClient;
}

export function setDatabaseForTests(client) {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("La inyección de base de datos solo está permitida en tests.");
  }

  databaseClient = client;
}

export async function disconnectDatabase() {
  if (databaseClient) {
    await databaseClient.$disconnect();
    databaseClient = undefined;
  }
}
