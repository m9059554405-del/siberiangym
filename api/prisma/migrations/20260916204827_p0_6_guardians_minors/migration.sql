-- AlterTable
ALTER TABLE "consent_records" ADD COLUMN     "guardian_id" TEXT;

-- AlterTable
ALTER TABLE "gyms" ADD COLUMN     "self_training_min_age" INTEGER NOT NULL DEFAULT 18;

-- CreateTable
CREATE TABLE "guardians" (
    "id" TEXT NOT NULL,
    "gym_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "relation" TEXT NOT NULL,
    "linked_client_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guardians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guardian_children" (
    "id" TEXT NOT NULL,
    "guardian_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guardian_children_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guardians_linked_client_id_key" ON "guardians"("linked_client_id");

-- CreateIndex
CREATE INDEX "guardians_gym_id_idx" ON "guardians"("gym_id");

-- CreateIndex
CREATE INDEX "guardians_phone_idx" ON "guardians"("phone");

-- CreateIndex
CREATE INDEX "guardian_children_client_id_idx" ON "guardian_children"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "guardian_children_guardian_id_client_id_key" ON "guardian_children"("guardian_id", "client_id");

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "guardians"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardians" ADD CONSTRAINT "guardians_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardians" ADD CONSTRAINT "guardians_linked_client_id_fkey" FOREIGN KEY ("linked_client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_children" ADD CONSTRAINT "guardian_children_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "guardians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_children" ADD CONSTRAINT "guardian_children_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
