-- P2.8: централизованное управление шкафчиками — режим точки и
-- оборудование киоска (банк/контроллер/канал, датчик дверцы).
CREATE TYPE "LockerMode" AS ENUM ('manual', 'centralized_kiosk');
ALTER TABLE "gyms" ADD COLUMN "locker_mode" "LockerMode" NOT NULL DEFAULT 'manual';

CREATE TYPE "LockerDoorState" AS ENUM ('OPEN', 'CLOSED');
ALTER TABLE "lockers" ADD COLUMN "bank_id" TEXT;
ALTER TABLE "lockers" ADD COLUMN "controller_id" TEXT;
ALTER TABLE "lockers" ADD COLUMN "channel_number" INTEGER;
ALTER TABLE "lockers" ADD COLUMN "door_state" "LockerDoorState";
ALTER TABLE "lockers" ADD COLUMN "assigned_at" TIMESTAMP(3);
