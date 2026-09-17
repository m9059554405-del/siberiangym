-- CreateEnum
CREATE TYPE "CheckinSource" AS ENUM ('QR', 'MANUAL');

-- CreateTable
CREATE TABLE "checkins" (
    "id" TEXT NOT NULL,
    "gym_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "CheckinSource" NOT NULL DEFAULT 'QR',

    CONSTRAINT "checkins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "checkins_gym_id_at_idx" ON "checkins"("gym_id", "at");

-- CreateIndex
CREATE INDEX "checkins_client_id_at_idx" ON "checkins"("client_id", "at");

-- AddForeignKey
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
