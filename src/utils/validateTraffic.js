export const LICENSE_CATEGORIES = [
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
];

export const LICENSE_STATUSES = ["active", "suspended", "revoked", "expired"];
export const INFRACTION_STATUSES = ["pending", "paid", "cancelled"];

function isValidDate(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

export function validateCreateCitizenPayload(payload) {
  payload = payload ?? {};
  const errors = [];

  if (!payload.name || String(payload.name).trim().length < 3) {
    errors.push("El nombre debe tener al menos 3 caracteres.");
  }

  const email = String(payload.email ?? "").trim();
  if (!email || email.length > 160) {
    errors.push(
      "El identificador de acceso es obligatorio y admite hasta 160 caracteres."
    );
  }

  if (
    typeof payload.password !== "string" ||
    payload.password.length < 6 ||
    payload.password.length > 72
  ) {
    errors.push("La contraseña definitiva debe tener entre 6 y 72 caracteres.");
  }

  if (!payload.dni || String(payload.dni).trim().length < 5) {
    errors.push("El DNI debe tener al menos 5 caracteres.");
  }

  if (!isValidDate(payload.birthDate)) {
    errors.push("birthDate debe contener una fecha válida.");
  } else if (new Date(payload.birthDate) >= new Date()) {
    errors.push("birthDate debe ser anterior a la fecha actual.");
  }

  const address = payload.address ?? {};
  for (const field of ["street", "postalCode", "city", "province"]) {
    if (!address[field] || String(address[field]).trim().length < 2) {
      errors.push(`address.${field} debe tener al menos 2 caracteres.`);
    }
  }

  if (!payload.phone || String(payload.phone).trim().length < 5) {
    errors.push("El teléfono debe tener al menos 5 caracteres.");
  }

  if (![8, 12].includes(Number(payload.initialPoints))) {
    errors.push("initialPoints debe ser 8 o 12.");
  }

  return errors;
}

export function validateInfractionPayload(payload) {
  payload = payload ?? {};
  const errors = [];

  if (!Number.isInteger(Number(payload.citizenId))) {
    errors.push("citizenId debe ser un identificador numérico.");
  }

  if (
    payload.vehicleId !== undefined &&
    payload.vehicleId !== null &&
    !Number.isInteger(Number(payload.vehicleId))
  ) {
    errors.push("vehicleId debe ser un identificador numérico.");
  }

  if (!payload.code || String(payload.code).trim().length < 2) {
    errors.push("El código de la infracción es obligatorio.");
  }

  if (!payload.description || String(payload.description).trim().length < 5) {
    errors.push("La descripción debe tener al menos 5 caracteres.");
  }

  if (!isValidDate(payload.occurredAt)) {
    errors.push("occurredAt debe contener una fecha válida.");
  }

  if (!payload.location || String(payload.location).trim().length < 3) {
    errors.push("La localización debe tener al menos 3 caracteres.");
  }

  const points = Number(payload.pointsToDeduct);
  if (![0, 2, 3, 4, 6].includes(points)) {
    errors.push("pointsToDeduct debe ser uno de estos valores: 0, 2, 3, 4 o 6.");
  }

  const fineAmount = Number(payload.fineAmount);
  if (!Number.isFinite(fineAmount) || fineAmount < 0) {
    errors.push("fineAmount debe ser un número igual o superior a 0.");
  }

  return errors;
}

export function validatePointAdjustmentPayload(payload) {
  payload = payload ?? {};
  const errors = [];
  const delta = Number(payload.delta);

  if (!Number.isInteger(delta) || delta === 0 || delta < -15 || delta > 15) {
    errors.push("delta debe ser un entero distinto de 0 entre -15 y 15.");
  }

  if (!payload.reason || String(payload.reason).trim().length < 5) {
    errors.push("El motivo debe tener al menos 5 caracteres.");
  }

  return errors;
}

export function validateLicenseStatusPayload(payload) {
  payload = payload ?? {};
  const errors = [];

  if (!LICENSE_STATUSES.includes(payload.status)) {
    errors.push(`status debe ser uno de: ${LICENSE_STATUSES.join(", ")}.`);
  }

  if (
    ["suspended", "revoked"].includes(payload.status) &&
    (!payload.reason || String(payload.reason).trim().length < 5)
  ) {
    errors.push("El motivo es obligatorio para suspender o retirar un permiso.");
  }

  if (payload.effectiveAt && !isValidDate(payload.effectiveAt)) {
    errors.push("effectiveAt debe contener una fecha válida.");
  }

  return errors;
}

export function validateInfractionStatusPayload(payload) {
  payload = payload ?? {};
  const errors = [];

  if (!INFRACTION_STATUSES.includes(payload.status)) {
    errors.push(`status debe ser uno de: ${INFRACTION_STATUSES.join(", ")}.`);
  }

  if (
    payload.status === "cancelled" &&
    (!payload.reason || String(payload.reason).trim().length < 5)
  ) {
    errors.push("El motivo es obligatorio para anular una infracción.");
  }

  return errors;
}
