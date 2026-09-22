-- CreateTable
CREATE TABLE "halls" (
    "id" TEXT NOT NULL,
    "gym_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "halls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hall_trainers" (
    "id" TEXT NOT NULL,
    "hall_id" TEXT NOT NULL,
    "trainer_id" TEXT NOT NULL,

    CONSTRAINT "hall_trainers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hall_prices" (
    "id" TEXT NOT NULL,
    "hall_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "hall_prices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "halls_gym_id_idx" ON "halls"("gym_id");

-- CreateIndex
CREATE UNIQUE INDEX "hall_trainers_hall_id_trainer_id_key" ON "hall_trainers"("hall_id", "trainer_id");

-- CreateIndex
CREATE INDEX "hall_trainers_trainer_id_idx" ON "hall_trainers"("trainer_id");

-- CreateIndex
CREATE INDEX "hall_prices_hall_id_idx" ON "hall_prices"("hall_id");

-- AddForeignKey
ALTER TABLE "halls" ADD CONSTRAINT "halls_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hall_trainers" ADD CONSTRAINT "hall_trainers_hall_id_fkey" FOREIGN KEY ("hall_id") REFERENCES "halls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hall_trainers" ADD CONSTRAINT "hall_trainers_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hall_prices" ADD CONSTRAINT "hall_prices_hall_id_fkey" FOREIGN KEY ("hall_id") REFERENCES "halls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- BackfillData
-- Точка без зала существовать не может: каждой существующей точке
-- создаётся дефолтный тренажёрный зал (заявка клуба).
INSERT INTO "halls" ("id", "gym_id", "name", "kind")
SELECT 'hall_def_' || "id", "id", 'Тренажерный зал', 'Тренажерный зал'
FROM "gyms";
