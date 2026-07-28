import "dotenv/config";
import { app } from "./app.js";
import { disconnectDatabase } from "./database/client.js";

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Mi Tráfico API disponible en http://localhost:${PORT}`);
});

async function shutdown(signal) {
  console.log(`${signal} recibido. Cerrando el servidor...`);
  server.close(async () => {
    await disconnectDatabase();
    process.exit(0);
  });
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
