import { createDatabaseClient } from "../src/database/client.js";
import { seedDatabase } from "../src/database/seedDatabase.js";

const database = createDatabaseClient();

try {
  const result = await seedDatabase(database);
  console.log(
    result.seeded
      ? "Datos académicos iniciales creados."
      : "La base de datos ya contiene usuarios; no se ha sobrescrito."
  );
} finally {
  await database.$disconnect();
}
