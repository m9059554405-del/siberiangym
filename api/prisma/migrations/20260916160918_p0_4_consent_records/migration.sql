-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('PDN_ADULT', 'PDN_MINOR_GUARDIAN', 'HEALTH_DATA', 'ACTIVITY_WAIVER_ADULT', 'ACTIVITY_WAIVER_MINOR_GUARDIAN', 'MARKETING_MEDIA', 'MARKETING_NEWSLETTER', 'STAFF_PDN');

-- CreateTable
CREATE TABLE "consent_records" (
    "id" TEXT NOT NULL,
    "gym_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "type" "ConsentType" NOT NULL,
    "version" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consent_records_gym_id_idx" ON "consent_records"("gym_id");

-- CreateIndex
CREATE INDEX "consent_records_client_id_type_idx" ON "consent_records"("client_id", "type");

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
