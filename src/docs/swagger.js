import swaggerUi from "swagger-ui-express";
import { openApiDocument } from "./openapi.js";

export function registerSwagger(app) {
  app.get("/api/docs.json", (req, res) => {
    res.json(openApiDocument);
  });

  app.use(
    "/api/docs",
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, {
      customSiteTitle: "Mi Tráfico API · Swagger",
      customCss: ".swagger-ui .topbar { background-color: #183153; }",
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        tryItOutEnabled: true,
      },
    })
  );
}
