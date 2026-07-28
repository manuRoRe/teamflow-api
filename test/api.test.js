import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { Pool } from "pg";
import { newDb } from "pg-mem";

let baseUrl;
let server;
let testDatabase;
let testPool;
let citizenToken;
let adminToken;

function addPrismaRowModeSupport(memoryPg) {
  const originalQuery = memoryPg.Client.prototype.query;

  memoryPg.Client.prototype.query = function query(
    statement,
    valuesOrCallback,
    callback
  ) {
    if (
      typeof statement !== "object" ||
      (!statement.rowMode && !statement.types)
    ) {
      return originalQuery.call(this, statement, valuesOrCallback, callback);
    }

    const normalizedStatement = { ...statement };
    delete normalizedStatement.rowMode;
    delete normalizedStatement.types;

    const transform = (result) => {
      const keys = Object.keys(result.rows[0] ?? {});
      return {
        ...result,
        fields: keys.map((name) => {
          const value = result.rows.find((row) => row[name] != null)?.[name];
          const dataTypeID =
            value instanceof Date
              ? 1114
              : typeof value === "number"
                ? name === "fine_amount"
                  ? 1700
                  : 23
                : typeof value === "boolean"
                  ? 16
                  : 25;
          return { name, dataTypeID };
        }),
        rows: result.rows.map((row) => keys.map((key) => row[key])),
      };
    };

    if (typeof valuesOrCallback === "function") {
      return originalQuery.call(this, normalizedStatement, (error, result) =>
        valuesOrCallback(error, error ? undefined : transform(result))
      );
    }
    if (typeof callback === "function") {
      return originalQuery.call(
        this,
        normalizedStatement,
        valuesOrCallback,
        (error, result) =>
          callback(error, error ? undefined : transform(result))
      );
    }

    return originalQuery
      .call(this, normalizedStatement, valuesOrCallback)
      .then(transform);
  };
}

async function api(pathname, options = {}) {
  const headers = { ...(options.headers ?? {}) };

  if (options.body) {
    headers["content-type"] = "application/json";
  }

  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const body = response.status === 204 ? null : await response.json();
  return { status: response.status, body };
}

async function login(email, password) {
  const response = await api("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
  assert.equal(response.status, 200);
  return response.body.token;
}

before(async () => {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  process.env.JWT_SECRET = "test-secret-only";
  process.env.FRONTEND_URLS = "http://localhost:5173";

  const memoryDatabase = newDb({
    autoCreateForeignKeyIndices: true,
    noAstCoverageCheck: true,
  });
  const memoryPg = memoryDatabase.adapters.createPg();
  addPrismaRowModeSupport(memoryPg);
  testPool = new Pool({ Client: memoryPg.Client });

  const migration = await readFile(
    new URL(
      "../prisma/migrations/20260728010000_initial_postgresql/migration.sql",
      import.meta.url
    ),
    "utf8"
  );
  await testPool.query(migration);

  const adapter = new PrismaPg(testPool);
  testDatabase = new PrismaClient({ adapter });
  const { setDatabaseForTests } = await import("../src/database/client.js");
  const { seedDatabase } = await import("../src/database/seedDatabase.js");
  setDatabaseForTests(testDatabase);
  await seedDatabase(testDatabase);

  const { app } = await import("../src/app.js");
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;

  citizenToken = await login("laura@trafico.test", "user123");
  adminToken = await login("agente@trafico.test", "admin123");
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
  await testDatabase?.$disconnect();
  await testPool?.end();
});

test("publica Swagger UI y una especificación OpenAPI importable", async () => {
  const specification = await api("/api/docs.json");

  assert.equal(specification.status, 200);
  assert.equal(specification.body.openapi, "3.0.3");
  assert.equal(specification.body.info.title, "Mi Tráfico API");
  const documentedPaths = [
    "/api/health",
    "/api/auth/login",
    "/api/auth/me",
    "/api/me",
    "/api/me/profile",
    "/api/me/summary",
    "/api/me/vehicles",
    "/api/me/licenses",
    "/api/me/infractions",
    "/api/me/pointMovements",
    "/api/admin/citizens",
    "/api/admin/citizens/{citizenId}",
    "/api/admin/vehicles",
    "/api/admin/infractions",
    "/api/admin/infractions/{infractionId}/status",
    "/api/admin/citizens/{citizenId}/point-adjustments",
    "/api/admin/citizens/{citizenId}/licenses/{licenseId}/status",
  ];
  for (const pathname of documentedPaths) {
    assert.ok(
      specification.body.paths[pathname],
      `${pathname} no está documentada`
    );
  }

  const references = [];
  JSON.stringify(specification.body, (key, value) => {
    if (key === "$ref") references.push(value);
    return value;
  });
  for (const reference of references) {
    const target = reference
      .replace("#/", "")
      .split("/")
      .reduce((current, part) => current?.[part], specification.body);
    assert.ok(target, `Referencia OpenAPI no resuelta: ${reference}`);
  }

  assert.equal(
    specification.body.components.securitySchemes.bearerAuth.scheme,
    "bearer"
  );
  assert.ok(specification.body.paths["/api/admin/citizens"].post);
  const createSchema =
    specification.body.components.schemas.CreateCitizenRequest;
  assert.equal(createSchema.properties.email.format, undefined);
  assert.equal(createSchema.properties.password.writeOnly, true);
  assert.deepEqual(createSchema.properties.initialPoints.enum, [8, 12]);
  assert.ok(
    specification.body.components.schemas.Health.required.includes("database")
  );

  const ui = await fetch(`${baseUrl}/api/docs/`);
  assert.equal(ui.status, 200);
  assert.match(ui.headers.get("content-type"), /text\/html/);
  assert.match(await ui.text(), /swagger-ui/);
});

test("permite que Swagger llame a la API detrás del proxy de Render", async () => {
  const renderOrigin = "https://mi-trafico-api.onrender.com";
  const sameRenderOrigin = await api("/api/health", {
    headers: {
      origin: renderOrigin,
      "x-forwarded-proto": "https",
      "x-forwarded-host": "mi-trafico-api.onrender.com",
    },
  });
  assert.equal(sameRenderOrigin.status, 200);

  const configuredFrontend = await api("/api/health", {
    headers: { origin: "http://localhost:5173" },
  });
  assert.equal(configuredFrontend.status, 200);

  const unknownOrigin = await api("/api/health", {
    headers: { origin: "https://example.invalid" },
  });
  assert.equal(unknownOrigin.status, 403);
  assert.equal(unknownOrigin.body.message, "Origen no permitido por CORS.");
});

test("health comprueba también la conexión con PostgreSQL", async () => {
  const response = await api("/api/health");
  assert.equal(response.status, 200);
  assert.equal(response.body.status, "ok");
  assert.equal(response.body.database, "connected");
});

test("protege los expedientes y limita las rutas por rol", async () => {
  const unauthenticated = await api("/api/me");
  assert.equal(unauthenticated.status, 401);

  const citizenAsAdmin = await api("/api/admin/citizens", {
    headers: { authorization: `Bearer ${citizenToken}` },
  });
  assert.equal(citizenAsAdmin.status, 403);

  const createAsCitizen = await api("/api/admin/citizens", {
    method: "POST",
    headers: { authorization: `Bearer ${citizenToken}` },
    body: {},
  });
  assert.equal(createAsCitizen.status, 403);

  const adminAsCitizen = await api("/api/me", {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(adminAsCitizen.status, 403);
});

test("el administrador crea un ciudadano persistente con contraseña definitiva", async () => {
  const payload = {
    name: "Álex de Prueba",
    email: "usuario-sin-formato-email",
    password: "clave-definitiva",
    dni: "11111111H",
    birthDate: "2001-04-20",
    address: {
      street: "Calle Académica 10",
      postalCode: "28080",
      city: "Madrid",
      province: "Madrid",
    },
    phone: "600000001",
    initialPoints: 12,
    role: "admin",
  };

  const created = await api("/api/admin/citizens", {
    method: "POST",
    headers: { authorization: `Bearer ${adminToken}` },
    body: payload,
  });

  assert.equal(created.status, 201);
  assert.equal(created.body.user.role, "citizen");
  assert.equal(created.body.user.email, payload.email);
  assert.equal(created.body.citizen.points, 12);
  assert.equal("password" in created.body.user, false);
  assert.equal("passwordHash" in created.body.user, false);

  const newCitizenToken = await login(payload.email, payload.password);
  const profile = await api("/api/me/profile", {
    headers: { authorization: `Bearer ${newCitizenToken}` },
  });
  assert.equal(profile.status, 200);
  assert.equal(profile.body.dni, payload.dni);

  const search = await api(
    `/api/admin/citizens?search=${encodeURIComponent("usuario-sin")}`,
    { headers: { authorization: `Bearer ${adminToken}` } }
  );
  assert.equal(search.status, 200);
  assert.ok(search.body.some((citizen) => citizen.dni === payload.dni));

  const duplicate = await api("/api/admin/citizens", {
    method: "POST",
    headers: { authorization: `Bearer ${adminToken}` },
    body: { ...payload, dni: "22222222J" },
  });
  assert.equal(duplicate.status, 409);
});

test("el ciudadano solo obtiene su expediente asociado al token", async () => {
  const response = await api("/api/me", {
    headers: { authorization: `Bearer ${citizenToken}` },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.profile.id, 1);
  assert.equal(response.body.profile.email, "laura@trafico.test");
  assert.equal(response.body.summary.currentPoints, 9);
  assert.deepEqual(
    response.body.vehicles.map((vehicle) => vehicle.ownerCitizenId),
    [1, 1]
  );
});

test("crear una infracción descuenta puntos y deja trazabilidad", async () => {
  const created = await api("/api/admin/infractions", {
    method: "POST",
    headers: { authorization: `Bearer ${adminToken}` },
    body: {
      citizenId: 1,
      vehicleId: 1,
      code: "SEM-ROJO",
      description: "No respetar la luz roja de un semáforo.",
      occurredAt: "2026-07-25T18:30:00.000Z",
      location: "Gran Vía 42, Madrid",
      pointsToDeduct: 4,
      fineAmount: 200,
    },
  });

  assert.equal(created.status, 201);
  assert.equal(created.body.pointsBefore, 9);
  assert.equal(created.body.pointsAfter, 5);
  assert.equal(created.body.recordedBy.userId, 1);

  const summary = await api("/api/me/summary", {
    headers: { authorization: `Bearer ${citizenToken}` },
  });
  assert.equal(summary.body.currentPoints, 5);
  assert.equal(summary.body.pendingInfractions, 2);
});

test("rechaza un vehículo que no pertenece al ciudadano sancionado", async () => {
  const response = await api("/api/admin/infractions", {
    method: "POST",
    headers: { authorization: `Bearer ${adminToken}` },
    body: {
      citizenId: 1,
      vehicleId: 3,
      code: "DOC-01",
      description: "Documentación no disponible.",
      occurredAt: "2026-07-25T18:30:00.000Z",
      location: "Madrid",
      pointsToDeduct: 0,
      fineAmount: 100,
    },
  });

  assert.equal(response.status, 409);
  assert.match(response.body.message, /no pertenece/i);
});

test("el administrador puede suspender un permiso con historial", async () => {
  const response = await api("/api/admin/citizens/1/licenses/1/status", {
    method: "PATCH",
    headers: { authorization: `Bearer ${adminToken}` },
    body: {
      status: "suspended",
      reason: "Suspensión cautelar de prueba.",
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.status, "suspended");
  assert.equal(response.body.statusHistory.at(-1).from, "active");
  assert.equal(response.body.statusHistory.at(-1).recordedBy.userId, 1);
});

test("el administrador puede realizar un ajuste manual de puntos", async () => {
  const response = await api("/api/admin/citizens/1/point-adjustments", {
    method: "POST",
    headers: { authorization: `Bearer ${adminToken}` },
    body: {
      delta: -2,
      reason: "Corrección administrativa de prueba.",
    },
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.balanceBefore, 5);
  assert.equal(response.body.balanceAfter, 3);
  assert.equal(response.body.delta, -2);
});

test("anular una infracción devuelve los puntos retirados", async () => {
  const response = await api("/api/admin/infractions/3/status", {
    method: "PATCH",
    headers: { authorization: `Bearer ${adminToken}` },
    body: {
      status: "cancelled",
      reason: "Recurso estimado en la prueba.",
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.status, "cancelled");

  const summary = await api("/api/me/summary", {
    headers: { authorization: `Bearer ${citizenToken}` },
  });
  assert.equal(summary.body.currentPoints, 7);
  assert.equal(summary.body.pendingInfractions, 1);
});
