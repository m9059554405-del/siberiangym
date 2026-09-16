import type { ConsentType } from '../types'

// Что показываем обычному клиенту (18+) — и на блокирующем экране
// согласия (ConsentGate), и в разделе «Мои данные» (PersonalDataSection).
// Guardian-варианты (несовершеннолетний) и согласие сотрудника сюда не
// входят: они не применимы к обычному клиенту и будут не понятны в этом
// контексте, у них появится собственный процесс, завязанный на сущность
// Guardian (P0.6) и на форму заведения тренера (P1.4), которых пока нет.
export const CLIENT_VISIBLE_CONSENT_TYPES: ConsentType[] = [
  'PDN_ADULT',
  'HEALTH_DATA',
  'ACTIVITY_WAIVER_ADULT',
  'MARKETING_MEDIA',
  'MARKETING_NEWSLETTER',
]
