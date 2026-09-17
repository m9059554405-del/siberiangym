-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('EMPLOYEE', 'SELF_EMPLOYED', 'SOLE_PROPRIETOR');

-- AlterTable
ALTER TABLE "consent_records" ADD COLUMN     "trainer_id" TEXT,
ALTER COLUMN "client_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "trainers" ADD COLUMN     "employment_type" "EmploymentType",
ADD COLUMN     "revenue_share_percent" INTEGER;

-- CreateIndex
CREATE INDEX "consent_records_trainer_id_type_idx" ON "consent_records"("trainer_id", "type");

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
