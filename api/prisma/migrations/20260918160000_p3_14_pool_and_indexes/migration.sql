-- P3.14: составные индексы под горячие запросы расписания — «занятия
-- точки за диапазон дат» (фильтр gymId+date сразу) для групповых занятий
-- и персональных слотов. Составной индекс (series_id, date) уже создан
-- миграцией p2_12 (проверено живым прогоном migrate deploy на dev-базе:
-- повторное CREATE INDEX падало с 42P07).
CREATE INDEX "group_classes_gym_id_date_idx" ON "group_classes"("gym_id", "date");
CREATE INDEX "personal_slots_gym_id_date_idx" ON "personal_slots"("gym_id", "date");
