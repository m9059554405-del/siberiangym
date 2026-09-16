// Тот же расчёт, что в api/src/clients/age.util.ts — используется здесь
// только для подсказки в форме до отправки (нельзя сохранить карточку без
// тренера, если дата рождения делает клиента несовершеннолетним);
// финальную проверку в любом случае делает сервер с реальным порогом
// зала, здесь — разумное дефолтное предположение (18) для UX.
export const DEFAULT_SELF_TRAINING_MIN_AGE = 18

export function calculateAge(birthday: string, asOf: Date = new Date()): number {
  const b = new Date(birthday)
  let age = asOf.getFullYear() - b.getFullYear()
  const hasHadBirthdayThisYear = asOf.getMonth() > b.getMonth() || (asOf.getMonth() === b.getMonth() && asOf.getDate() >= b.getDate())
  if (!hasHadBirthdayThisYear) age -= 1
  return age
}

export function isLikelyMinor(birthday: string, minAge: number = DEFAULT_SELF_TRAINING_MIN_AGE): boolean {
  if (!birthday) return false
  return calculateAge(birthday) < minAge
}
