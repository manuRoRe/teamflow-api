import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

let baseUrl;
let server;
let testDataDirectory;
let citizenToken;
let adminToken;

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
  testDataDirectory = await mkdtemp(path.join(os.tmpdir(), "mi-trafico-api-"));
  await copyFile(
    path.resolve("src/data/traffic-store.seed.json"),
    path.join(testDataDirectory, "traffic-store.json")
  );

  process.env.DATA_DIR = testDataDirectory;
  process.env.JWT_SECRET = "test-secret-only";
  process.env.FRONTEND_URL = "http://localhost:5173";

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
  if (testDataDirectory) {
    await rm(testDataDirectory, { recursive: true, force: true });
  }
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
    assert.ok(specification.body.paths[pathname], `${pathname} no está documentada`);
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

  const ui = await fetch(`${baseUrl}/api/docs/`);
  assert.equal(ui.status, 200);
  assert.match(ui.headers.get("content-type"), /text\/html/);
  assert.match(await ui.text(), /swagger-ui/);

  const stylesheet = await fetch(`${baseUrl}/api/docs/swagger-ui.css`);
  assert.equal(stylesheet.status, 200);
  assert.match(stylesheet.headers.get("content-type"), /text\/css/);
});

test("protege los expedientes y limita las rutas por rol", async () => {
  const unauthenticated = await api("/api/me");
  assert.equal(unauthenticated.status, 401);

  const citizenAsAdmin = await api("/api/admin/citizens", {
    headers: { authorization: `Bearer ${citizenToken}` },
  });
  assert.equal(citizenAsAdmin.status, 403);

  const adminAsCitizen = await api("/api/me", {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(adminAsCitizen.status, 403);
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
