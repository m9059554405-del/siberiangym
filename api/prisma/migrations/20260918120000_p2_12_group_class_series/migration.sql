-- P2.12: серии регулярных групповых занятий. group_class_series — шаблон
-- еженедельного расписания (дни недели + время + горизонт генерации),
-- group_classes.series_id — связь конкретного занятия-occurrence с серией
-- (null = занятие создано вручную, как раньше). Отмена серии мягкая
-- (cancelled_at), поэтому FK не каскадит и жёстких удалений серии нет.
CREATE TABLE "group_class_series" (
    "id" TEXT NOT NULL,
    "gym_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "trainer_id" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "start" TEXT NOT NULL,
    "end" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "weekdays" INTEGER[],
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "horizon_days" INTEGER NOT NULL DEFAULT 28,
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_class_series_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "group_class_series_gym_id_idx" ON "group_class_series"("gym_id");
CREATE INDEX "group_class_series_trainer_id_idx" ON "group_class_series"("trainer_id");

ALTER TABLE "group_class_series" ADD CONSTRAINT "group_class_series_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "group_class_series" ADD CONSTRAINT "group_class_series_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "group_classes" ADD COLUMN "series_id" TEXT;

CREATE INDEX "group_classes_series_id_idx" ON "group_classes"("series_id");
CREATE INDEX "group_classes_series_id_date_idx" ON "group_classes"("series_id", "date");

ALTER TABLE "group_classes" ADD CONSTRAINT "group_classes_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "group_class_series"("id") ON DELETE SET NULL ON UPDATE CASCADE;
