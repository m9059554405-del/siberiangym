-- CreateTable
CREATE TABLE "trainer_gyms" (
    "id" TEXT NOT NULL,
    "trainer_id" TEXT NOT NULL,
    "gym_id" TEXT NOT NULL,

    CONSTRAINT "trainer_gyms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trainer_gyms_gym_id_idx" ON "trainer_gyms"("gym_id");

-- CreateIndex
CREATE UNIQUE INDEX "trainer_gyms_trainer_id_gym_id_key" ON "trainer_gyms"("trainer_id", "gym_id");

-- AddForeignKey
ALTER TABLE "trainer_gyms" ADD CONSTRAINT "trainer_gyms_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainer_gyms" ADD CONSTRAINT "trainer_gyms_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
