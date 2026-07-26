const errorResponse = (description) => ({
  description,
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/Error" },
    },
  },
});

const jsonResponse = (description, schema) => ({
  description,
  content: {
    "application/json": {
      schema,
    },
  },
});

const idParameter = (name, description) => ({
  name,
  in: "path",
  required: true,
  description,
  schema: { type: "integer", minimum: 1 },
  example: 1,
});

export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Mi Tráfico API",
    version: "2.0.0",
    description: `
API académica inspirada en los servicios de tráfico.

## Cómo probarla
1. Ejecuta **POST /api/auth/login** con una de las credenciales de ejemplo.
2. Copia el valor \`token\` de la respuesta.
3. Pulsa **Authorize** y pega solamente el token. Swagger añadirá \`Bearer\`.
4. Prueba las rutas correspondientes al rol con el que hayas iniciado sesión.

**Ciudadano:** solo puede consultar su propio expediente mediante \`/api/me\`.

**Administrador:** puede consultar expedientes y registrar operaciones mediante
\`/api/admin\`.

> Es una simplificación educativa y no representa un procedimiento oficial de la DGT.
`,
    contact: {
      name: "Proyecto académico Mi Tráfico",
    },
  },
  servers: [
    {
      url: "/",
      description: "Mismo servidor desde el que se ha abierto Swagger",
    },
  ],
  tags: [
    { name: "Sistema", description: "Estado y disponibilidad de la API." },
    { name: "Autenticación", description: "Inicio de sesión y token actual." },
    { name: "Mi expediente", description: "Consultas del ciudadano autenticado." },
    {
      name: "Administración",
      description: "Consultas y operaciones reservadas al agente administrador.",
    },
  ],
  paths: {
    "/api/health": {
      get: {
        tags: ["Sistema"],
        summary: "Comprobar el estado de la API",
        operationId: "getHealth",
        security: [],
        responses: {
          200: jsonResponse("La API está disponible.", {
            $ref: "#/components/schemas/Health",
          }),
        },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Autenticación"],
        summary: "Iniciar sesión",
        description:
          "Devuelve un JWT válido durante 2 horas. Usa las credenciales del ejemplo ciudadano o del ejemplo administrador.",
        operationId: "login",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginRequest" },
              examples: {
                ciudadano: {
                  summary: "Ciudadano Laura",
                  value: {
                    email: "laura@trafico.test",
                    password: "user123",
                  },
                },
                administrador: {
                  summary: "Agente administrador",
                  value: {
                    email: "agente@trafico.test",
                    password: "admin123",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: jsonResponse("Sesión iniciada correctamente.", {
            $ref: "#/components/schemas/LoginResponse",
          }),
          401: errorResponse("Credenciales incorrectas."),
        },
      },
    },
    "/api/auth/me": {
      get: {
        tags: ["Autenticación"],
        summary: "Consultar el usuario del token",
        operationId: "getAuthenticatedUser",
        responses: {
          200: jsonResponse("Datos incluidos en el JWT.", {
            type: "object",
            required: ["user"],
            properties: {
              user: { $ref: "#/components/schemas/AuthUser" },
            },
          }),
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/me": {
      get: {
        tags: ["Mi expediente"],
        summary: "Consultar el expediente completo",
        description:
          "Solo admite un token de ciudadano. El expediente se obtiene del citizenId del JWT, no de un identificador enviado por el cliente.",
        operationId: "getMyTrafficRecord",
        responses: {
          200: jsonResponse("Expediente completo del ciudadano.", {
            $ref: "#/components/schemas/CitizenDetails",
          }),
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/me/profile": {
      get: {
        tags: ["Mi expediente"],
        summary: "Consultar mis datos personales",
        operationId: "getMyProfile",
        responses: {
          200: jsonResponse("Datos personales.", {
            $ref: "#/components/schemas/Citizen",
          }),
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/api/me/summary": {
      get: {
        tags: ["Mi expediente"],
        summary: "Consultar el resumen de mi expediente",
        operationId: "getMySummary",
        responses: {
          200: jsonResponse("Resumen del expediente.", {
            $ref: "#/components/schemas/TrafficSummary",
          }),
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/api/me/vehicles": {
      get: {
        tags: ["Mi expediente"],
        summary: "Consultar mis vehículos",
        operationId: "getMyVehicles",
        responses: {
          200: jsonResponse("Vehículos del ciudadano.", {
            type: "array",
            items: { $ref: "#/components/schemas/Vehicle" },
          }),
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/api/me/licenses": {
      get: {
        tags: ["Mi expediente"],
        summary: "Consultar mis permisos de conducción",
        operationId: "getMyLicenses",
        responses: {
          200: jsonResponse("Permisos del ciudadano.", {
            type: "array",
            items: { $ref: "#/components/schemas/DrivingLicense" },
          }),
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/api/me/infractions": {
      get: {
        tags: ["Mi expediente"],
        summary: "Consultar mis infracciones",
        operationId: "getMyInfractions",
        responses: {
          200: jsonResponse("Infracciones ordenadas por fecha.", {
            type: "array",
            items: { $ref: "#/components/schemas/Infraction" },
          }),
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/api/me/pointMovements": {
      get: {
        tags: ["Mi expediente"],
        summary: "Consultar mi historial de puntos",
        operationId: "getMyPointMovements",
        responses: {
          200: jsonResponse("Movimientos de puntos ordenados por fecha.", {
            type: "array",
            items: { $ref: "#/components/schemas/PointMovement" },
          }),
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/api/admin/citizens": {
      get: {
        tags: ["Administración"],
        summary: "Buscar ciudadanos",
        operationId: "listCitizens",
        parameters: [
          {
            name: "search",
            in: "query",
            required: false,
            description: "Texto contenido en el nombre, DNI o email.",
            schema: { type: "string" },
            example: "Laura",
          },
        ],
        responses: {
          200: jsonResponse("Listado de ciudadanos.", {
            type: "array",
            items: { $ref: "#/components/schemas/Citizen" },
          }),
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/api/admin/citizens/{citizenId}": {
      get: {
        tags: ["Administración"],
        summary: "Consultar el expediente de un ciudadano",
        operationId: "getCitizenById",
        parameters: [idParameter("citizenId", "Identificador del ciudadano.")],
        responses: {
          200: jsonResponse("Expediente completo.", {
            $ref: "#/components/schemas/CitizenDetails",
          }),
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/admin/vehicles": {
      get: {
        tags: ["Administración"],
        summary: "Buscar vehículos",
        operationId: "listVehicles",
        parameters: [
          {
            name: "citizenId",
            in: "query",
            description: "Filtra por propietario.",
            schema: { type: "integer", minimum: 1 },
            example: 1,
          },
          {
            name: "registrationPlate",
            in: "query",
            description: "Texto contenido en la matrícula.",
            schema: { type: "string" },
            example: "1234",
          },
        ],
        responses: {
          200: jsonResponse("Listado de vehículos.", {
            type: "array",
            items: { $ref: "#/components/schemas/Vehicle" },
          }),
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/api/admin/infractions": {
      get: {
        tags: ["Administración"],
        summary: "Listar infracciones",
        operationId: "listInfractions",
        parameters: [
          {
            name: "citizenId",
            in: "query",
            description: "Filtra por ciudadano responsable.",
            schema: { type: "integer", minimum: 1 },
            example: 1,
          },
          {
            name: "vehicleId",
            in: "query",
            description: "Filtra por vehículo.",
            schema: { type: "integer", minimum: 1 },
            example: 1,
          },
          {
            name: "status",
            in: "query",
            description: "Filtra por estado.",
            schema: {
              type: "string",
              enum: ["pending", "paid", "cancelled"],
            },
            example: "pending",
          },
        ],
        responses: {
          200: jsonResponse("Listado de infracciones.", {
            type: "array",
            items: { $ref: "#/components/schemas/Infraction" },
          }),
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
      post: {
        tags: ["Administración"],
        summary: "Registrar una infracción",
        description:
          "El ciudadano es obligatorio y el vehículo es opcional. Si se envía vehicleId, debe pertenecer al ciudadano. Los puntos se descuentan automáticamente.",
        operationId: "createInfraction",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateInfractionRequest" },
              example: {
                citizenId: 1,
                vehicleId: 1,
                code: "SEM-ROJO",
                description: "No respetar la luz roja de un semáforo.",
                occurredAt: "2026-07-25T18:30:00.000Z",
                location: "Gran Vía 42, Madrid",
                pointsToDeduct: 4,
                fineAmount: 200,
                notes: "Identificación presencial.",
              },
            },
          },
        },
        responses: {
          201: jsonResponse("Infracción creada y puntos aplicados.", {
            $ref: "#/components/schemas/Infraction",
          }),
          400: { $ref: "#/components/responses/ValidationError" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
          409: errorResponse("El vehículo no pertenece al ciudadano."),
        },
      },
    },
    "/api/admin/infractions/{infractionId}/status": {
      patch: {
        tags: ["Administración"],
        summary: "Cambiar el estado de una infracción",
        description:
          "Al anular una infracción se restituyen sus puntos, sin superar el máximo de 15.",
        operationId: "updateInfractionStatus",
        parameters: [
          idParameter("infractionId", "Identificador de la infracción."),
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/InfractionStatusRequest" },
              examples: {
                pagar: {
                  summary: "Marcar como pagada",
                  value: { status: "paid", reason: "Pago registrado." },
                },
                anular: {
                  summary: "Anular y devolver puntos",
                  value: {
                    status: "cancelled",
                    reason: "Recurso estimado por error de identificación.",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: jsonResponse("Estado actualizado.", {
            $ref: "#/components/schemas/Infraction",
          }),
          400: { $ref: "#/components/responses/ValidationError" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
          409: errorResponse("Transición de estado no permitida."),
        },
      },
    },
    "/api/admin/citizens/{citizenId}/point-adjustments": {
      post: {
        tags: ["Administración"],
        summary: "Realizar un ajuste manual de puntos",
        description:
          "Usa un delta negativo para retirar y uno positivo para devolver puntos. El saldo siempre queda entre 0 y 15.",
        operationId: "adjustCitizenPoints",
        parameters: [idParameter("citizenId", "Identificador del ciudadano.")],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/PointAdjustmentRequest" },
              examples: {
                retirar: {
                  summary: "Retirar 2 puntos",
                  value: {
                    delta: -2,
                    reason: "Corrección administrativa del expediente.",
                  },
                },
                devolver: {
                  summary: "Devolver 2 puntos",
                  value: {
                    delta: 2,
                    reason: "Resolución favorable al interesado.",
                  },
                },
              },
            },
          },
        },
        responses: {
          201: jsonResponse("Movimiento de puntos creado.", {
            $ref: "#/components/schemas/PointMovement",
          }),
          400: { $ref: "#/components/responses/ValidationError" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
          409: errorResponse("El saldo ya se encuentra en el límite."),
        },
      },
    },
    "/api/admin/citizens/{citizenId}/licenses/{licenseId}/status": {
      patch: {
        tags: ["Administración"],
        summary: "Cambiar el estado de un permiso",
        description:
          "Permite activar, suspender, retirar o marcar como caducado un permiso. Suspender o retirar requiere un motivo.",
        operationId: "updateLicenseStatus",
        parameters: [
          idParameter("citizenId", "Identificador del ciudadano."),
          idParameter("licenseId", "Identificador del permiso."),
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LicenseStatusRequest" },
              example: {
                status: "suspended",
                reason: "Suspensión cautelar acordada por la autoridad.",
                effectiveAt: "2026-07-26T10:00:00.000Z",
              },
            },
          },
        },
        responses: {
          200: jsonResponse("Estado del permiso actualizado.", {
            $ref: "#/components/schemas/DrivingLicense",
          }),
          400: { $ref: "#/components/responses/ValidationError" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
          409: errorResponse("El permiso ya tiene el estado solicitado."),
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description:
          "Introduce solamente el token devuelto por POST /api/auth/login.",
      },
    },
    responses: {
      Unauthorized: errorResponse("Token ausente, inválido o expirado."),
      Forbidden: errorResponse("El rol del usuario no permite esta operación."),
      NotFound: errorResponse("El recurso solicitado no existe."),
      ValidationError: {
        description: "El cuerpo de la petición contiene datos inválidos.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ValidationError" },
          },
        },
      },
    },
    schemas: {
      Error: {
        type: "object",
        required: ["message"],
        properties: {
          message: { type: "string", example: "Token no enviado." },
          path: { type: "string", example: "/api/ruta-inexistente" },
        },
      },
      ValidationError: {
        allOf: [
          { $ref: "#/components/schemas/Error" },
          {
            type: "object",
            required: ["errors"],
            properties: {
              errors: {
                type: "array",
                items: { type: "string" },
                example: ["pointsToDeduct debe ser uno de estos valores: 0, 2, 3, 4 o 6."],
              },
            },
          },
        ],
      },
      Health: {
        type: "object",
        required: ["status", "app", "timestamp"],
        properties: {
          status: { type: "string", example: "ok" },
          app: { type: "string", example: "Mi Tráfico API" },
          timestamp: {
            type: "string",
            format: "date-time",
            example: "2026-07-26T10:00:00.000Z",
          },
        },
      },
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: {
            type: "string",
            format: "email",
            example: "laura@trafico.test",
          },
          password: { type: "string", format: "password", example: "user123" },
        },
      },
      AuthUser: {
        type: "object",
        required: ["id", "name", "email", "role", "citizenId"],
        properties: {
          id: { type: "integer", example: 2 },
          name: { type: "string", example: "Laura García Ruiz" },
          email: {
            type: "string",
            format: "email",
            example: "laura@trafico.test",
          },
          role: {
            type: "string",
            enum: ["citizen", "admin"],
            example: "citizen",
          },
          citizenId: {
            type: "integer",
            nullable: true,
            example: 1,
            description: "Es null para el administrador.",
          },
          iat: {
            type: "integer",
            readOnly: true,
            description: "Fecha de emisión del JWT.",
          },
          exp: {
            type: "integer",
            readOnly: true,
            description: "Fecha de expiración del JWT.",
          },
        },
      },
      LoginResponse: {
        type: "object",
        required: ["token", "user"],
        properties: {
          token: {
            type: "string",
            description: "JWT que debe enviarse en Authorization.",
            example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
          },
          user: { $ref: "#/components/schemas/AuthUser" },
        },
      },
      Address: {
        type: "object",
        required: ["street", "postalCode", "city", "province"],
        properties: {
          street: { type: "string", example: "Calle de Alcalá 120" },
          postalCode: { type: "string", example: "28009" },
          city: { type: "string", example: "Madrid" },
          province: { type: "string", example: "Madrid" },
        },
      },
      Citizen: {
        type: "object",
        required: [
          "id",
          "dni",
          "name",
          "birthDate",
          "address",
          "email",
          "phone",
          "points",
          "pointsUpdatedAt",
        ],
        properties: {
          id: { type: "integer", example: 1 },
          dni: { type: "string", example: "12345678Z" },
          name: { type: "string", example: "Laura García Ruiz" },
          birthDate: {
            type: "string",
            format: "date",
            example: "1994-05-18",
          },
          address: { $ref: "#/components/schemas/Address" },
          email: {
            type: "string",
            format: "email",
            example: "laura@trafico.test",
          },
          phone: { type: "string", example: "+34600111222" },
          points: { type: "integer", minimum: 0, maximum: 15, example: 9 },
          pointsUpdatedAt: {
            type: "string",
            format: "date-time",
            example: "2026-03-11T09:45:00.000Z",
          },
        },
      },
      Vehicle: {
        type: "object",
        required: [
          "id",
          "ownerCitizenId",
          "registrationPlate",
          "vin",
          "make",
          "model",
          "year",
          "fuel",
          "status",
        ],
        properties: {
          id: { type: "integer", example: 1 },
          ownerCitizenId: { type: "integer", example: 1 },
          registrationPlate: { type: "string", example: "1234-LGT" },
          vin: { type: "string", example: "VSSZZZKJZMR000001" },
          make: { type: "string", example: "SEAT" },
          model: { type: "string", example: "León" },
          year: { type: "integer", example: 2021 },
          fuel: {
            type: "string",
            example: "gasoline",
          },
          inspectionValidUntil: {
            type: "string",
            format: "date",
            example: "2027-02-15",
          },
          insuranceValidUntil: {
            type: "string",
            format: "date",
            example: "2027-01-31",
          },
          status: { type: "string", example: "active" },
        },
      },
      RecordedBy: {
        type: "object",
        required: ["userId", "name"],
        properties: {
          userId: { type: "integer", example: 1 },
          name: { type: "string", example: "Agente Administrador" },
        },
      },
      LicenseHistoryEntry: {
        type: "object",
        required: ["from", "to", "reason", "changedAt", "recordedBy"],
        properties: {
          from: { $ref: "#/components/schemas/LicenseStatus" },
          to: { $ref: "#/components/schemas/LicenseStatus" },
          reason: { type: "string", example: "Suspensión cautelar." },
          changedAt: { type: "string", format: "date-time" },
          recordedBy: { $ref: "#/components/schemas/RecordedBy" },
        },
      },
      LicenseStatus: {
        type: "string",
        enum: ["active", "suspended", "revoked", "expired"],
        example: "active",
      },
      DrivingLicense: {
        type: "object",
        required: [
          "id",
          "citizenId",
          "category",
          "licenseNumber",
          "issuedAt",
          "expiresAt",
          "status",
          "statusHistory",
        ],
        properties: {
          id: { type: "integer", example: 1 },
          citizenId: { type: "integer", example: 1 },
          category: {
            type: "string",
            enum: [
              "AM",
              "A1",
              "A2",
              "A",
              "B",
              "B+E",
              "C1",
              "C1+E",
              "C",
              "C+E",
              "D1",
              "D1+E",
              "D",
              "D+E",
            ],
            example: "B",
          },
          licenseNumber: { type: "string", example: "L-12345678-B" },
          issuedAt: { type: "string", format: "date", example: "2013-06-20" },
          expiresAt: { type: "string", format: "date", example: "2033-06-20" },
          status: { $ref: "#/components/schemas/LicenseStatus" },
          statusReason: { type: "string", example: "" },
          statusChangedAt: {
            type: "string",
            format: "date-time",
          },
          statusHistory: {
            type: "array",
            items: { $ref: "#/components/schemas/LicenseHistoryEntry" },
          },
        },
      },
      InfractionStatus: {
        type: "string",
        enum: ["pending", "paid", "cancelled"],
        example: "pending",
      },
      Infraction: {
        type: "object",
        required: [
          "id",
          "reference",
          "citizenId",
          "code",
          "description",
          "occurredAt",
          "location",
          "pointsDeducted",
          "fineAmount",
          "status",
          "pointsBefore",
          "pointsAfter",
          "createdAt",
          "recordedBy",
        ],
        properties: {
          id: { type: "integer", example: 1 },
          reference: { type: "string", example: "INF-2026-00001" },
          citizenId: { type: "integer", example: 1 },
          vehicleId: { type: "integer", nullable: true, example: 1 },
          code: { type: "string", example: "VEL-GRAVE" },
          description: {
            type: "string",
            example: "Exceso de velocidad superior al límite permitido.",
          },
          occurredAt: { type: "string", format: "date-time" },
          location: { type: "string", example: "A-6, km 18, Madrid" },
          pointsDeducted: {
            type: "integer",
            enum: [0, 2, 3, 4, 6],
            example: 3,
          },
          fineAmount: {
            type: "number",
            format: "double",
            minimum: 0,
            example: 200,
          },
          status: { $ref: "#/components/schemas/InfractionStatus" },
          notes: { type: "string", example: "Control de velocidad." },
          pointsBefore: { type: "integer", example: 12 },
          pointsAfter: { type: "integer", example: 9 },
          createdAt: { type: "string", format: "date-time" },
          recordedBy: { $ref: "#/components/schemas/RecordedBy" },
          statusChangedAt: { type: "string", format: "date-time" },
          statusReason: { type: "string" },
          statusChangedBy: { $ref: "#/components/schemas/RecordedBy" },
          previousStatus: {
            allOf: [{ $ref: "#/components/schemas/InfractionStatus" }],
            readOnly: true,
          },
        },
      },
      PointMovement: {
        type: "object",
        required: [
          "id",
          "citizenId",
          "type",
          "delta",
          "balanceBefore",
          "balanceAfter",
          "reason",
          "createdAt",
          "recordedBy",
        ],
        properties: {
          id: { type: "integer", example: 1 },
          citizenId: { type: "integer", example: 1 },
          type: {
            type: "string",
            enum: ["infraction", "manual_adjustment", "infraction_cancelled"],
            example: "infraction",
          },
          delta: { type: "integer", example: -3 },
          requestedDelta: { type: "integer", example: -3 },
          balanceBefore: { type: "integer", example: 12 },
          balanceAfter: { type: "integer", example: 9 },
          reason: {
            type: "string",
            example: "INF-2026-00001: Exceso de velocidad.",
          },
          infractionId: { type: "integer", nullable: true, example: 1 },
          createdAt: { type: "string", format: "date-time" },
          recordedBy: { $ref: "#/components/schemas/RecordedBy" },
        },
      },
      TrafficSummary: {
        type: "object",
        required: [
          "currentPoints",
          "vehicleCount",
          "activeLicenseCategories",
          "pendingInfractions",
          "pendingFineAmount",
          "canDrive",
        ],
        properties: {
          currentPoints: {
            type: "integer",
            minimum: 0,
            maximum: 15,
            example: 9,
          },
          vehicleCount: { type: "integer", example: 2 },
          activeLicenseCategories: {
            type: "array",
            items: { type: "string" },
            example: ["B", "A2"],
          },
          pendingInfractions: { type: "integer", example: 1 },
          pendingFineAmount: { type: "number", example: 200 },
          canDrive: { type: "boolean", example: true },
        },
      },
      CitizenDetails: {
        type: "object",
        required: [
          "profile",
          "vehicles",
          "licenses",
          "infractions",
          "pointMovements",
          "summary",
        ],
        properties: {
          profile: { $ref: "#/components/schemas/Citizen" },
          vehicles: {
            type: "array",
            items: { $ref: "#/components/schemas/Vehicle" },
          },
          licenses: {
            type: "array",
            items: { $ref: "#/components/schemas/DrivingLicense" },
          },
          infractions: {
            type: "array",
            items: { $ref: "#/components/schemas/Infraction" },
          },
          pointMovements: {
            type: "array",
            items: { $ref: "#/components/schemas/PointMovement" },
          },
          summary: { $ref: "#/components/schemas/TrafficSummary" },
        },
      },
      CreateInfractionRequest: {
        type: "object",
        required: [
          "citizenId",
          "code",
          "description",
          "occurredAt",
          "location",
          "pointsToDeduct",
          "fineAmount",
        ],
        properties: {
          citizenId: { type: "integer", minimum: 1, example: 1 },
          vehicleId: {
            type: "integer",
            minimum: 1,
            nullable: true,
            example: 1,
          },
          code: { type: "string", minLength: 2, example: "SEM-ROJO" },
          description: {
            type: "string",
            minLength: 5,
            example: "No respetar la luz roja de un semáforo.",
          },
          occurredAt: { type: "string", format: "date-time" },
          location: {
            type: "string",
            minLength: 3,
            example: "Gran Vía 42, Madrid",
          },
          pointsToDeduct: {
            type: "integer",
            enum: [0, 2, 3, 4, 6],
            example: 4,
          },
          fineAmount: { type: "number", minimum: 0, example: 200 },
          notes: { type: "string", example: "Identificación presencial." },
        },
      },
      PointAdjustmentRequest: {
        type: "object",
        required: ["delta", "reason"],
        properties: {
          delta: {
            type: "integer",
            minimum: -15,
            maximum: 15,
            not: { enum: [0] },
            example: -2,
          },
          reason: {
            type: "string",
            minLength: 5,
            example: "Corrección administrativa del expediente.",
          },
        },
      },
      LicenseStatusRequest: {
        type: "object",
        required: ["status"],
        properties: {
          status: { $ref: "#/components/schemas/LicenseStatus" },
          reason: {
            type: "string",
            description: "Obligatorio para suspended y revoked.",
            example: "Suspensión cautelar acordada por la autoridad.",
          },
          effectiveAt: {
            type: "string",
            format: "date-time",
            description: "Si se omite, se utiliza la fecha actual.",
          },
        },
      },
      InfractionStatusRequest: {
        type: "object",
        required: ["status"],
        properties: {
          status: { $ref: "#/components/schemas/InfractionStatus" },
          reason: {
            type: "string",
            description: "Obligatorio al anular.",
            example: "Recurso estimado por error de identificación.",
          },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
};
