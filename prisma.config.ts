import "dotenv/config";
import { defineConfig } from "prisma/config";

const databaseUrl = String(
  process.env.DATABASE_URL ?? process.env.DB_URL ?? ""
).trim();

if (process.env.RENDER && !databaseUrl) {
  throw new Error(
    "Configura DATABASE_URL o DB_URL con la URL interna de PostgreSQL."
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node prisma/seed.js",
  },
  datasource: {
    url:
      databaseUrl ||
      "postgresql://postgres:postgres@localhost:5432/mi_trafico",
  },
});
