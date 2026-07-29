# Mi Tráfico API

Backend académico inspirado en los servicios de tráfico. Un ciudadano puede
consultar sus datos, vehículos, permisos, infracciones y movimientos de puntos.
Un administrador puede consultar expedientes, crear ciudadanos, registrar
infracciones, ajustar puntos y cambiar el estado de permisos.

> Es una simplificación educativa. No representa la operativa oficial de la DGT
> y no debe utilizarse con datos personales reales.

## Tecnologías

- Node.js 22, Express y JWT
- PostgreSQL y Prisma ORM
- Contraseñas cifradas con bcrypt
- Swagger UI / OpenAPI 3
- Pruebas de integración con `node:test`
- Blueprint preparado para Render

## Puesta en marcha local

Necesitas Node.js y una base de datos PostgreSQL.

```bash
npm install
cp .env.example .env
npm run db:generate
npm run db:deploy
npm run db:seed
npm run dev
```

En Windows PowerShell puedes sustituir `cp` por:

```powershell
Copy-Item .env.example .env
```

Variables de entorno:

```env
PORT=3000
JWT_SECRET=una_clave_larga_y_privada
DATABASE_URL=postgresql://usuario:password@host:5432/mi_trafico
FRONTEND_URLS=http://localhost:5173
LOGIN_RATE_LIMIT=100
```

La conexión puede configurarse con `DATABASE_URL` o, como alias, `DB_URL`.
En Render utiliza la URL interna completa proporcionada por PostgreSQL.

`FRONTEND_URLS` admite varios orígenes separados por comas. No se debe guardar
el archivo `.env` en Git.

`LOGIN_RATE_LIMIT` define cuántos intentos de acceso admite cada IP durante 15
minutos. El valor docente predeterminado es `100` para evitar bloqueos cuando
varios alumnos comparten la misma red.

## Swagger

Con la API en ejecución:

- Interfaz: `http://localhost:3000/api/docs`
- Especificación JSON: `http://localhost:3000/api/docs.json`

Para probar una ruta privada:

1. Ejecuta `POST /api/auth/login`.
2. Copia el campo `token`.
3. Pulsa **Authorize** y pega solamente el token.
4. Ejecuta rutas de `/api/me` o `/api/admin` según el rol.

## Credenciales iniciales

| Perfil | Identificador | Contraseña | Rol |
| --- | --- | --- | --- |
| Agente | `agente@trafico.test` | `admin123` | `admin` |
| Laura | `laura@trafico.test` | `user123` | `citizen` |
| Diego | `diego@trafico.test` | `user123` | `citizen` |

La semilla solo se aplica cuando la tabla de usuarios está vacía. Las
contraseñas se guardan cifradas, nunca en texto plano.

## Autenticación

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "agente@trafico.test",
  "password": "admin123"
}
```

Aunque el campo se llama `email` por compatibilidad con el contrato existente,
se trata como un identificador de acceso: es obligatorio y único, pero no se
valida su formato. Las rutas privadas requieren:

```http
Authorization: Bearer TOKEN
```

## Crear un ciudadano

Solo un administrador puede crear usuarios y siempre se crean con el rol
`citizen`. La contraseña enviada es definitiva; no hay verificación por email ni
flujo de cambio obligatorio.

```http
POST /api/admin/citizens
Authorization: Bearer TOKEN_ADMIN
Content-Type: application/json

{
  "name": "Álex García",
  "email": "alex-identificador",
  "password": "clave-definitiva",
  "dni": "11111111H",
  "birthDate": "2001-04-20",
  "address": {
    "street": "Calle Académica 10",
    "postalCode": "28080",
    "city": "Madrid",
    "province": "Madrid"
  },
  "phone": "600000001",
  "initialPoints": 12
}
```

`initialPoints` admite `8` o `12`. El identificador y el DNI deben ser únicos.
La respuesta nunca devuelve la contraseña ni su hash.

## Rutas principales

Todas las rutas `/api/me` requieren rol `citizen`. El ciudadano se obtiene del
token, por lo que no puede elegir otro expediente.

| Método | Ruta | Función |
| --- | --- | --- |
| `GET` | `/api/me` | Expediente y resumen completos |
| `GET` | `/api/me/profile` | Datos personales |
| `GET` | `/api/me/summary` | Puntos y totales |
| `GET` | `/api/me/vehicles` | Vehículos propios |
| `GET` | `/api/me/licenses` | Permisos de conducción |
| `GET` | `/api/me/infractions` | Infracciones |
| `GET` | `/api/me/pointMovements` | Historial de puntos |

Todas las rutas `/api/admin` requieren rol `admin`.

| Método | Ruta | Función |
| --- | --- | --- |
| `GET` | `/api/admin/citizens` | Buscar ciudadanos |
| `POST` | `/api/admin/citizens` | Crear un ciudadano |
| `GET` | `/api/admin/citizens/:citizenId` | Consultar un expediente |
| `GET` | `/api/admin/vehicles` | Buscar vehículos |
| `GET` | `/api/admin/infractions` | Filtrar infracciones |
| `POST` | `/api/admin/infractions` | Registrar una infracción y descontar puntos |
| `PATCH` | `/api/admin/infractions/:infractionId/status` | Pagar o anular una infracción |
| `POST` | `/api/admin/citizens/:citizenId/point-adjustments` | Ajustar puntos |
| `PATCH` | `/api/admin/citizens/:citizenId/licenses/:licenseId/status` | Cambiar un permiso |

El contrato completo, los valores admitidos y los ejemplos están en Swagger.

## Base de datos y Prisma

Para desarrollo local, inicia la PostgreSQL incluida en `compose.yaml` y prepara
los datos:

```bash
npm run db:start
npm run db:deploy
npm run db:seed
npm run db:studio
```

Prisma Studio mostrará en la terminal la URL local que debes abrir. El contenedor
conserva los datos en el volumen `teamflow_postgres_data`. Para detenerlo ejecuta
`npm run db:stop`.

Si PowerShell bloquea `npm.ps1` por la política de ejecución, usa `npm.cmd` en
los mismos comandos, por ejemplo:

```powershell
npm.cmd run db:start
npm.cmd run db:deploy
npm.cmd run db:seed
npm.cmd run db:studio
```

Docker Desktop debe estar abierto antes de ejecutar `db:start`.
La base local de TeamFlow se publica en el puerto `5433` para no interferir con
otras instalaciones de PostgreSQL que utilicen el puerto habitual `5432`.

Otros comandos disponibles:

```bash
npm run db:generate  # genera Prisma Client
npm run db:migrate   # crea una migración durante desarrollo
npm run db:deploy    # aplica migraciones existentes
npm run db:seed      # carga usuarios y expedientes iniciales si la BBDD está vacía
npm run db:studio    # interfaz de inspección
```

La migración inicial está en `prisma/migrations` y la semilla académica en
`prisma/seed-data.json`. El runtime no escribe archivos JSON.

## Despliegue gratuito en Render

El archivo `render.yaml` crea un servicio web y una PostgreSQL gratuita:

1. Sube el repositorio a GitHub.
2. En Render elige **New > Blueprint**.
3. Conecta el repositorio y aplica el Blueprint.
4. Render genera `JWT_SECRET`, enlaza `DATABASE_URL`, ejecuta las migraciones y
   carga la semilla.
5. Abre `https://TU-SERVICIO.onrender.com/api/docs`.

El Blueprint configura `FRONTEND_URLS=*` para que los alumnos puedan consumir la
API desde Swagger, servidores locales con distintos puertos o frontends
desplegados en servicios como Vercel y Netlify. La API utiliza tokens Bearer, no
cookies de sesión, y las rutas privadas siguen protegidas mediante JWT y roles.

Si el proyecto deja de ser académico o empieza a manejar datos reales, sustituye
`*` por los orígenes permitidos separados por comas.

La PostgreSQL gratuita de Render caduca 30 días después de su creación, tiene
1 GB y no incluye copias de seguridad. Para un curso más largo habrá que crear
otra base, exportar los datos previamente o usar un plan de pago. Consulta las
[limitaciones oficiales del plan gratuito](https://render.com/docs/free) y la
[guía de conexión de PostgreSQL](https://render.com/docs/postgresql-creating-connecting).

## Pruebas

```bash
npm test
```

Las pruebas levantan una PostgreSQL compatible en memoria, aplican la migración
y verifican autenticación, roles, persistencia, infracciones, puntos, permisos y
Swagger. No necesitan una base local ni modifican la de Render.

## Conexión desde React + Vite

```env
VITE_API_URL=https://TU-SERVICIO.onrender.com/api
```

```js
import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});
```
