import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

let databaseClient;

export function resolveDatabaseUrl(
  connectionString,
  environment = process.env
) {
  return String(
    connectionString ?? environment.DATABASE_URL ?? environment.DB_URL ?? ""
  ).trim();
}

export function createDatabaseClient(connectionString) {
  const databaseUrl = resolveDatabaseUrl(connectionString);

  if (!databaseUrl) {
    throw new Error("DATABASE_URL o DB_URL no está configurada.");
  }

  const adapter = new PrismaPg({
    connectionString: databaseUrl,
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
