-- AlterTable
-- P2.1: учёт заморозки абонемента — израсходованные дни лимита в текущем
-- оплаченном периоде и дата окончания активной заморозки.
ALTER TABLE "memberships" ADD COLUMN     "frozen_days_used" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "freeze_ends_at" DATE;
