# Mi Tráfico API

Backend académico inspirado en la sede electrónica de tráfico. Permite que un
ciudadano consulte su expediente y que un agente administrador registre
infracciones, ajuste puntos o cambie el estado de un permiso de conducción.

> Este proyecto simplifica procedimientos administrativos reales. No representa
> la operativa oficial de la DGT ni debe utilizarse con datos reales.

## Tecnologías

- Node.js y Express
- JWT para autenticación
- Roles `citizen` y `admin`
- Persistencia didáctica en JSON
- Pruebas de integración con `node:test`

## Instalación

```bash
npm install
cp .env.example .env
npm run dev
```

La API queda disponible en `http://localhost:3000/api`.

Variables de entorno:

```env
PORT=3000
JWT_SECRET=super_secret_dev_key_change_me
FRONTEND_URL=http://localhost:5173
```

## Credenciales de demostración

| Perfil | Email | Contraseña | Rol |
| --- | --- | --- | --- |
| Agente | `agente@trafico.test` | `admin123` | `admin` |
| Laura | `laura@trafico.test` | `user123` | `citizen` |
| Diego | `diego@trafico.test` | `user123` | `citizen` |

Las contraseñas en texto plano solo se mantienen para facilitar el uso en clase.
En producción deben guardarse con hash y la persistencia debe migrarse a una base
de datos.

## Swagger para clase

Con el servidor en ejecución, abre:

```txt
http://localhost:3000/api/docs
```

Swagger muestra todos los endpoints, modelos, parámetros, posibles respuestas y
ejemplos. Para probar las rutas privadas:

1. Abre `POST /api/auth/login`, pulsa **Try it out** y usa una de las credenciales
   de demostración.
2. Ejecuta la petición y copia el campo `token` de la respuesta.
3. Pulsa **Authorize** en la parte superior de Swagger.
4. Pega solamente el token, sin escribir `Bearer`, y confirma.
5. Ya puedes ejecutar las rutas de `/api/me` o `/api/admin` según el rol elegido.

La autorización permanece guardada mientras se recarga la página. Para cambiar
de ciudadano a administrador, pulsa **Authorize**, cierra la sesión anterior e
introduce el nuevo token.

La especificación OpenAPI también puede descargarse o importarse en Postman,
Insomnia y otras herramientas desde:

```txt
http://localhost:3000/api/docs.json
```

## Autenticación

### Iniciar sesión

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "laura@trafico.test",
  "password": "user123"
}
```

La respuesta contiene el JWT y el usuario:

```json
{
  "token": "jwt...",
  "user": {
    "id": 2,
    "name": "Laura García Ruiz",
    "email": "laura@trafico.test",
    "role": "citizen",
    "citizenId": 1
  }
}
```

Las rutas privadas requieren:

```http
Authorization: Bearer TOKEN
```

## Rutas del ciudadano

Todas las rutas `/api/me` requieren el rol `citizen`. El identificador del
ciudadano se toma del token, nunca de la URL, para impedir que consulte el
expediente de otra persona.

| Método | Ruta | Respuesta |
| --- | --- | --- |
| `GET` | `/api/me` | Expediente completo y resumen |
| `GET` | `/api/me/profile` | Datos personales |
| `GET` | `/api/me/summary` | Puntos, totales y aptitud básica |
| `GET` | `/api/me/vehicles` | Vehículos propios |
| `GET` | `/api/me/licenses` | Permisos y sus estados |
| `GET` | `/api/me/infractions` | Multas e infracciones |
| `GET` | `/api/me/pointMovements` | Historial auditable de puntos |

También está disponible `GET /api/auth/me` para consultar los datos contenidos
en el token.

## Rutas del administrador

Todas las rutas `/api/admin` requieren el rol `admin`.

### Consultas

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/api/admin/citizens?search=Laura` | Busca por nombre, DNI o email |
| `GET` | `/api/admin/citizens/:citizenId` | Expediente completo |
| `GET` | `/api/admin/vehicles?registrationPlate=1234` | Busca vehículos |
| `GET` | `/api/admin/infractions?status=pending` | Lista y filtra infracciones |

Los listados de vehículos e infracciones también aceptan `citizenId`. Las
infracciones aceptan además `vehicleId`.

### Registrar una infracción

```http
POST /api/admin/infractions
Authorization: Bearer TOKEN_ADMIN
Content-Type: application/json

{
  "citizenId": 1,
  "vehicleId": 1,
  "code": "SEM-ROJO",
  "description": "No respetar la luz roja de un semáforo.",
  "occurredAt": "2026-07-25T18:30:00.000Z",
  "location": "Gran Vía 42, Madrid",
  "pointsToDeduct": 4,
  "fineAmount": 200,
  "notes": "Identificación presencial."
}
```

`vehicleId` es opcional. Si se incluye, el vehículo debe pertenecer al ciudadano.
Al crear la infracción se descuenta el número de puntos indicado (`0`, `2`, `3`,
`4` o `6`), sin permitir un saldo negativo, y se crea un movimiento de puntos.

### Corregir puntos manualmente

```http
POST /api/admin/citizens/1/point-adjustments
Authorization: Bearer TOKEN_ADMIN
Content-Type: application/json

{
  "delta": -2,
  "reason": "Corrección administrativa del expediente."
}
```

`delta` admite valores entre -15 y 15, excepto 0. El saldo final siempre queda
entre 0 y 15. Esta operación sirve para correcciones o recuperaciones; la
deducción normal debe realizarse creando una infracción.

### Suspender, retirar o reactivar un permiso

```http
PATCH /api/admin/citizens/1/licenses/1/status
Authorization: Bearer TOKEN_ADMIN
Content-Type: application/json

{
  "status": "suspended",
  "reason": "Suspensión cautelar acordada por la autoridad.",
  "effectiveAt": "2026-07-26T10:00:00.000Z"
}
```

Estados admitidos: `active`, `suspended`, `revoked` y `expired`. Suspender o
retirar (`revoked`) requiere un motivo. Cada cambio queda en `statusHistory`.

### Pagar o anular una infracción

```http
PATCH /api/admin/infractions/1/status
Authorization: Bearer TOKEN_ADMIN
Content-Type: application/json

{
  "status": "cancelled",
  "reason": "Recurso estimado por error de identificación."
}
```

Estados admitidos: `pending`, `paid` y `cancelled`. La anulación requiere motivo
y devuelve automáticamente los puntos retirados, respetando el máximo de 15.

## Reglas del modelo académico

- La infracción se asocia siempre a un ciudadano y, opcionalmente, a uno de sus
  vehículos.
- Los puntos pertenecen al ciudadano, no al vehículo.
- Una multa sin pérdida de puntos usa `pointsToDeduct: 0`.
- Llegar a 0 puntos no retira automáticamente todos los permisos: el agente debe
  registrar el cambio de estado que corresponda.
- Los cambios relevantes guardan fecha y agente para conservar trazabilidad.
- El sistema no implementa alegaciones, notificaciones, descuentos por pronto
  pago, titular/conductor distintos ni el procedimiento administrativo oficial.

La separación entre responsable y vehículo sigue la idea de que, según el tipo de
infracción, la responsabilidad puede recaer en el conductor o en el titular, y de
que una sanción con pérdida de puntos exige identificar al conductor. Los puntos
son comunes a todos los permisos de una persona. Como referencias de modelado se
han utilizado las páginas oficiales de la DGT sobre
[infracciones y sanciones](https://www.dgt.es/nuestros-servicios/multas-y-sanciones/conoce-los-tipos-de-infracciones-y-sanciones/),
[identificación del conductor](https://www.dgt.es/nuestros-servicios/multas-y-sanciones/que-hacer-si-has-recibido-una-multa/),
[permiso por puntos](https://www.dgt.es/nuestros-servicios/permisos-de-conducir/tus-puntos-y-tus-permisos/como-funciona-el-permiso-por-puntos/index.html)
y [clases de permisos](https://www.dgt.es/nuestros-servicios/permisos-de-conducir/clases-de-permisos-de-conducir/index.html).

## Datos y pruebas

Restaurar los datos iniciales:

```bash
npm run reset-data
```

Ejecutar las pruebas:

```bash
npm test
```

Las pruebas usan un directorio temporal, por lo que no modifican
`src/data/traffic-store.json`.

## Conexión desde React + Vite

```env
VITE_API_URL=http://localhost:3000/api
```

```js
import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});
```
