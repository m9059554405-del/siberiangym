// Возраст и статус "несовершеннолетний" (P0.6) — вычисляются на лету из
// даты рождения и настраиваемого на уровне зала порога, а не хранятся
// отдельным полем: клиент становится совершеннолетним сам, в день своего
// 18-летия (или другого настроенного возраста), без какого-либо
// планировщика/cron-задачи, которая должна была бы "переключить флаг".
export function calculateAge(birthday: Date, asOf: Date = new Date()): number {
  let age = asOf.getFullYear() - birthday.getFullYear();
  const hasHadBirthdayThisYear =
    asOf.getMonth() > birthday.getMonth() || (asOf.getMonth() === birthday.getMonth() && asOf.getDate() >= birthday.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

// null — дата рождения не указана, статус неизвестен (карточки, заведённые
// до того, как это поле стало практически обязательным, или где его
// специально не указали).
export function isMinor(birthday: Date | null, minAge: number, asOf: Date = new Date()): boolean | null {
  if (!birthday) return null;
  return calculateAge(birthday, asOf) < minAge;
}
