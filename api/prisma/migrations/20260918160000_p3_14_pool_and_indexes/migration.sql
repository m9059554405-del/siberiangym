-- P3.14: составные индексы под горячие запросы расписания — «занятия
-- точки за диапазон дат» (фильтр gymId+date сразу) для групповых занятий
-- и персональных слотов; плюс явный индекс occurrence-даты серии.
CREATE INDEX "group_classes_gym_id_date_idx" ON "group_classes"("gym_id", "date");
CREATE INDEX "group_classes_series_id_date_idx" ON "group_classes"("series_id", "date");
CREATE INDEX "personal_slots_gym_id_date_idx" ON "personal_slots"("gym_id", "date");
