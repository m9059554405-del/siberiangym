-- P4.2: настраиваемые часы работы точек, зоны клининга и цены тарифов
-- сопровождения — вместо констант, перенесённых из демо-версии.

-- Часы работы точки по дням недели (0=Пн … 6=Вс). Дня без строки нет =
-- ограничений на этот день нет (обратно совместимо с точками до P4.2).
CREATE TABLE "gym_working_hours" (
    "id" TEXT NOT NULL,
    "gym_id" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "open" TEXT NOT NULL,
    "close" TEXT NOT NULL,

    CONSTRAINT "gym_working_hours_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "gym_working_hours_gym_id_weekday_key" ON "gym_working_hours"("gym_id", "weekday");

ALTER TABLE "gym_working_hours" ADD CONSTRAINT "gym_working_hours_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Тарифы сопровождения тренера: раньше константа в коде (2500/4900/15900),
-- теперь настраиваются точкой. Дефолты = старой константе, цены не меняются.
ALTER TABLE "membership_pricing" ADD COLUMN     "escort_basic" INTEGER NOT NULL DEFAULT 2500,
ADD COLUMN     "escort_coaching" INTEGER NOT NULL DEFAULT 4900,
ADD COLUMN     "escort_individual" INTEGER NOT NULL DEFAULT 15900;

-- Зоны уборки точки: раньше глобальный enum из 7 значений демо-версии.
CREATE TABLE "cleaning_zones" (
    "id" TEXT NOT NULL,
    "gym_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "cleaning_zones_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cleaning_zones_gym_id_name_key" ON "cleaning_zones"("gym_id", "name");

ALTER TABLE "cleaning_zones" ADD CONSTRAINT "cleaning_zones_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Данные: каждой существующей точке — стартовый набор из семи зон старого
-- enum (локализованные имена, порядок = прежний порядок чек-листа).
INSERT INTO "cleaning_zones" ("id", "gym_id", "name", "position")
SELECT 'cz_' || g.id || '_' || n.ord, g.id, n.name, n.ord
FROM "gyms" g
CROSS JOIN (VALUES
  (0, 'Пол'), (1, 'Освещение'), (2, 'Поверхности'), (3, 'Зеркала'),
  (4, 'Санузлы'), (5, 'Шкафчики'), (6, 'Окна')
) AS n(ord, name);

-- Существующие пункты чек-листов переводятся на зоны своей точки.
ALTER TABLE "cleaning_checklist_items" ADD COLUMN "zone_id" TEXT;

UPDATE "cleaning_checklist_items" i
SET "zone_id" = z.id
FROM "cleaning_checklists" c, "cleaning_zones" z
WHERE i.checklist_id = c.id
  AND z.gym_id = c.gym_id
  AND z.name = CASE i.area
    WHEN 'FLOOR' THEN 'Пол'
    WHEN 'LIGHTING' THEN 'Освещение'
    WHEN 'SURFACES' THEN 'Поверхности'
    WHEN 'MIRRORS' THEN 'Зеркала'
    WHEN 'RESTROOMS' THEN 'Санузлы'
    WHEN 'LOCKERS' THEN 'Шкафчики'
    WHEN 'WINDOWS' THEN 'Окна'
  END;

ALTER TABLE "cleaning_checklist_items" ALTER COLUMN "zone_id" SET NOT NULL;

DROP INDEX "cleaning_checklist_items_checklist_id_area_key";

ALTER TABLE "cleaning_checklist_items" DROP COLUMN "area";

CREATE UNIQUE INDEX "cleaning_checklist_items_checklist_id_zone_id_key" ON "cleaning_checklist_items"("checklist_id", "zone_id");

ALTER TABLE "cleaning_checklist_items" ADD CONSTRAINT "cleaning_checklist_items_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "cleaning_zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP TYPE "CleaningArea";

-- Залечивание дрейфа: одиночный индекс series_id остался от старой версии
-- схемы и не создаётся ни одной миграцией; составной (series_id, date)
-- из p2_12 покрывает те же запросы по префиксу.
DROP INDEX "group_classes_series_id_idx";
