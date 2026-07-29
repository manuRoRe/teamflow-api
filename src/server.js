import "dotenv/config";
import { app } from "./app.js";
import {
  disconnectDatabase,
  getDatabase,
} from "./database/client.js";

const PORT = process.env.PORT || 3000;

async function startServer() {
  if (!process.env.JWT_SECRET?.trim()) {
    throw new Error("JWT_SECRET no está configurada.");
  }

  await getDatabase().$queryRaw`SELECT 1`;

  return app.listen(PORT, "0.0.0.0", () => {
    console.log(`Mi Tráfico API disponible en http://localhost:${PORT}`);
  });
}

let server;

try {
  server = await startServer();
} catch (error) {
  console.error(`No se pudo iniciar la API: ${error.message}`);
  await disconnectDatabase();
  process.exit(1);
}

async function shutdown(signal) {
  console.log(`${signal} recibido. Cerrando el servidor...`);
  server.close(async () => {
    await disconnectDatabase();
    process.exit(0);
  });
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
