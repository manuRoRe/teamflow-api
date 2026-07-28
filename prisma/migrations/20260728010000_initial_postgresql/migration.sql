CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(160) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "users_role_check" CHECK ("role" IN ('admin', 'citizen'))
);

CREATE TABLE "citizens" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "dni" VARCHAR(20) NOT NULL,
    "birth_date" DATE NOT NULL,
    "street" VARCHAR(180) NOT NULL,
    "postal_code" VARCHAR(20) NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "province" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(30) NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 12,
    "points_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "citizens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "citizens_points_check" CHECK ("points" BETWEEN 0 AND 15)
);

CREATE TABLE "vehicles" (
    "id" SERIAL NOT NULL,
    "owner_citizen_id" INTEGER NOT NULL,
    "registration_plate" VARCHAR(20) NOT NULL,
    "vin" VARCHAR(40) NOT NULL,
    "make" VARCHAR(80) NOT NULL,
    "model" VARCHAR(80) NOT NULL,
    "year" INTEGER NOT NULL,
    "fuel" VARCHAR(30) NOT NULL,
    "inspection_valid_until" DATE,
    "insurance_valid_until" DATE,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "driving_licenses" (
    "id" SERIAL NOT NULL,
    "citizen_id" INTEGER NOT NULL,
    "category" VARCHAR(10) NOT NULL,
    "license_number" VARCHAR(40) NOT NULL,
    "issued_at" DATE NOT NULL,
    "expires_at" DATE NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "status_reason" TEXT NOT NULL DEFAULT '',
    "status_changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "driving_licenses_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "driving_licenses_status_check"
      CHECK ("status" IN ('active', 'suspended', 'revoked', 'expired'))
);

CREATE TABLE "license_status_history" (
    "id" SERIAL NOT NULL,
    "license_id" INTEGER NOT NULL,
    "from_status" VARCHAR(20) NOT NULL,
    "to_status" VARCHAR(20) NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_by_user_id" INTEGER NOT NULL,
    CONSTRAINT "license_status_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "infractions" (
    "id" SERIAL NOT NULL,
    "reference" VARCHAR(30) NOT NULL,
    "citizen_id" INTEGER NOT NULL,
    "vehicle_id" INTEGER,
    "code" VARCHAR(40) NOT NULL,
    "description" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "location" VARCHAR(220) NOT NULL,
    "points_deducted" INTEGER NOT NULL,
    "fine_amount" DECIMAL(10,2) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "notes" TEXT NOT NULL DEFAULT '',
    "points_before" INTEGER NOT NULL,
    "points_after" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_by_user_id" INTEGER NOT NULL,
    "status_changed_at" TIMESTAMP(3),
    "status_reason" TEXT NOT NULL DEFAULT '',
    "status_changed_by_user_id" INTEGER,
    CONSTRAINT "infractions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "infractions_status_check"
      CHECK ("status" IN ('pending', 'paid', 'cancelled')),
    CONSTRAINT "infractions_points_check"
      CHECK ("points_deducted" IN (0, 2, 3, 4, 6)),
    CONSTRAINT "infractions_amount_check" CHECK ("fine_amount" >= 0)
);

CREATE TABLE "point_movements" (
    "id" SERIAL NOT NULL,
    "citizen_id" INTEGER NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "delta" INTEGER NOT NULL,
    "requested_delta" INTEGER,
    "balance_before" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "infraction_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_by_user_id" INTEGER NOT NULL,
    CONSTRAINT "point_movements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "point_movements_balance_check"
      CHECK ("balance_before" BETWEEN 0 AND 15 AND "balance_after" BETWEEN 0 AND 15)
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "citizens_user_id_key" ON "citizens"("user_id");
CREATE UNIQUE INDEX "citizens_dni_key" ON "citizens"("dni");
CREATE UNIQUE INDEX "vehicles_registration_plate_key" ON "vehicles"("registration_plate");
CREATE UNIQUE INDEX "vehicles_vin_key" ON "vehicles"("vin");
CREATE UNIQUE INDEX "driving_licenses_license_number_key" ON "driving_licenses"("license_number");
CREATE UNIQUE INDEX "driving_licenses_citizen_id_category_key"
  ON "driving_licenses"("citizen_id", "category");
CREATE UNIQUE INDEX "infractions_reference_key" ON "infractions"("reference");
CREATE INDEX "infractions_citizen_id_created_at_idx"
  ON "infractions"("citizen_id", "created_at");
CREATE INDEX "infractions_vehicle_id_idx" ON "infractions"("vehicle_id");
CREATE INDEX "infractions_status_idx" ON "infractions"("status");
CREATE INDEX "point_movements_citizen_id_created_at_idx"
  ON "point_movements"("citizen_id", "created_at");

ALTER TABLE "citizens"
  ADD CONSTRAINT "citizens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "citizens"
  ADD CONSTRAINT "citizens_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "vehicles"
  ADD CONSTRAINT "vehicles_owner_citizen_id_fkey"
  FOREIGN KEY ("owner_citizen_id") REFERENCES "citizens"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "driving_licenses"
  ADD CONSTRAINT "driving_licenses_citizen_id_fkey"
  FOREIGN KEY ("citizen_id") REFERENCES "citizens"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "license_status_history"
  ADD CONSTRAINT "license_status_history_license_id_fkey"
  FOREIGN KEY ("license_id") REFERENCES "driving_licenses"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "license_status_history"
  ADD CONSTRAINT "license_status_history_recorded_by_user_id_fkey"
  FOREIGN KEY ("recorded_by_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "infractions"
  ADD CONSTRAINT "infractions_citizen_id_fkey"
  FOREIGN KEY ("citizen_id") REFERENCES "citizens"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "infractions"
  ADD CONSTRAINT "infractions_vehicle_id_fkey"
  FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "infractions"
  ADD CONSTRAINT "infractions_recorded_by_user_id_fkey"
  FOREIGN KEY ("recorded_by_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "infractions"
  ADD CONSTRAINT "infractions_status_changed_by_user_id_fkey"
  FOREIGN KEY ("status_changed_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "point_movements"
  ADD CONSTRAINT "point_movements_citizen_id_fkey"
  FOREIGN KEY ("citizen_id") REFERENCES "citizens"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "point_movements"
  ADD CONSTRAINT "point_movements_infraction_id_fkey"
  FOREIGN KEY ("infraction_id") REFERENCES "infractions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "point_movements"
  ADD CONSTRAINT "point_movements_recorded_by_user_id_fkey"
  FOREIGN KEY ("recorded_by_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
