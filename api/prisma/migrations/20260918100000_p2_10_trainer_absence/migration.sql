-- P2.10: отсутствие и уход тренера. unavailable_from/unavailable_until —
-- календарный диапазон временной недоступности (отпуск/болезнь), оба поля
-- заполняются только вместе; departed_at — момент фиксации окончательного
-- ухода (необратим в операционке, логин тренера деактивируется отдельно
-- через User.isActive). Все три поля nullable: null = тренер работает как
-- обычно, значения задним числом существующим тренерам не выдумываем.
ALTER TABLE "trainers" ADD COLUMN "unavailable_from" DATE;
ALTER TABLE "trainers" ADD COLUMN "unavailable_until" DATE;
ALTER TABLE "trainers" ADD COLUMN "departed_at" TIMESTAMP(3);
