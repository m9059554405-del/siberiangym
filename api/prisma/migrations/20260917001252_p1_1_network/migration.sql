-- CreateTable
CREATE TABLE "networks" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "networks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "networks_owner_id_key" ON "networks"("owner_id");

-- AlterTable: сначала NULLABLE — не может быть NOT NULL, пока не заполнена
-- (в таблице уже есть строки), см. бэкфилл ниже.
ALTER TABLE "gyms" ADD COLUMN "network_id" TEXT;

-- Бэкфилл: один Network на каждый существующий Gym, владелец — первый по
-- дате создания CEO этого зала. На проде сейчас ровно один Gym и один CEO
-- (SiberianGym) — учтён и более общий случай (несколько независимых залов,
-- у каждого свой CEO), если миграция когда-либо прогоняется на другой БД.
DO $$
DECLARE
    gym_row RECORD;
    owner_user_id TEXT;
    new_network_id TEXT;
BEGIN
    FOR gym_row IN SELECT id, name FROM "gyms" WHERE "network_id" IS NULL LOOP
        SELECT id INTO owner_user_id FROM "users" WHERE "gym_id" = gym_row.id AND "role" = 'CEO' ORDER BY "created_at" ASC LIMIT 1;
        IF owner_user_id IS NULL THEN
            RAISE EXCEPTION 'У зала % (%) нет ни одного пользователя с ролью CEO — невозможно определить владельца новой Network', gym_row.id, gym_row.name;
        END IF;
        new_network_id := gen_random_uuid()::text;
        INSERT INTO "networks" ("id", "owner_id", "name", "created_at") VALUES (new_network_id, owner_user_id, gym_row.name, CURRENT_TIMESTAMP);
        UPDATE "gyms" SET "network_id" = new_network_id WHERE "id" = gym_row.id;
    END LOOP;
END $$;

-- AlterTable: теперь у каждой строки есть network_id — можно требовать NOT NULL.
ALTER TABLE "gyms" ALTER COLUMN "network_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "networks" ADD CONSTRAINT "networks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gyms" ADD CONSTRAINT "gyms_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "networks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
