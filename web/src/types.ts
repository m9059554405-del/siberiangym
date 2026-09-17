export type Gender = 'M' | 'F'
export type ClientFormat = 'PERSONAL' | 'GROUP' | 'SELF'
export type Tariff = 'BASIC' | 'COACHING' | 'INDIVIDUAL'
export type MembershipType = 'SINGLE' | 'MONTHLY' | 'PACK10' | 'PACK20'
export type MembershipStatus = 'ACTIVE' | 'EXPIRED' | 'FROZEN'
export type MuscleGroup = 'CHEST' | 'BACK' | 'LEGS' | 'SHOULDERS' | 'ARMS' | 'ABS' | 'CARDIO'
export type WorkoutStatus = 'COMPLETED' | 'PARTIAL' | 'MISSED'
export type EffortLevel = 'WARMUP' | 'EASY' | 'MEDIUM' | 'HARD' | 'VERY_HARD'
export type SlotStatus = 'FREE' | 'BOOKED' | 'PAST_COMPLETED' | 'PAST_MISSED'
export type LockerStatus = 'FREE' | 'RENTED'
export type CatalogCategory = 'FOOD' | 'WATER'
export type StockLocation = 'SHELF' | 'WAREHOUSE'
export type WriteoffReason = 'EXPIRED' | 'DAMAGED' | 'SOLD_MANUAL' | 'USED_INTERNALLY' | 'LOST' | 'OTHER'
export type ClubPostType = 'NEWS' | 'PHOTO' | 'VIDEO' | 'ACHIEVEMENT'
export type ProgressPhotoKind = 'FOOD' | 'BODY'
export type MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'OTHER'
export type TransactionCategory = 'MEMBERSHIP' | 'PERSONAL' | 'GROUP' | 'ANCILLARY' | 'REFUND'
export type OfferAudience = 'ALL' | 'EXPIRING_SOON' | 'TOP_PERFORMERS'

export type OrderStatus = 'DRAFT' | 'AWAITING_PAYMENT' | 'PAID' | 'CANCELLED' | 'EXPIRED'
export type OrderPaymentMethod = 'CASH' | 'CARD_ONLINE'
export type OrderLineType =
  | 'MEMBERSHIP_PURCHASE'
  | 'MEMBERSHIP_RENEWAL'
  | 'TARIFF_CHANGE'
  | 'STOCK_PURCHASE'
  | 'LOCKER_RENTAL'
  | 'GROUP_CLASS_BOOKING'
  | 'PERSONAL_SLOT_BOOKING'

export interface OrderLine {
  id: string
  type: OrderLineType
  refId: string | null
  amount: number
  meta: Record<string, unknown> | null
}

export interface Order {
  id: string
  clientId: string
  client?: Client
  createdBy: string
  status: OrderStatus
  paymentMethod: OrderPaymentMethod | null
  totalAmount: number
  receiptRaw: string | null
  receiptDate: string | null
  receiptFn: string | null
  receiptI: string | null
  receiptFp: string | null
  expiresAt: string | null
  paidAt: string | null
  cancelledAt: string | null
  cancelReason: string | null
  createdAt: string
  lines: OrderLine[]
}

export type RefundStatus = 'AWAITING_RECEIPT' | 'CONFIRMED' | 'CANCELLED'

export interface RefundLine {
  id: string
  orderLineId: string
  detail: string
}

export interface Refund {
  id: string
  orderId: string
  order?: Order
  requestedBy: string
  reason: string
  amount: number
  status: RefundStatus
  receiptRaw: string | null
  receiptDate: string | null
  receiptFn: string | null
  receiptI: string | null
  receiptFp: string | null
  confirmedAt: string | null
  cancelledAt: string | null
  createdAt: string
  lines: RefundLine[]
}

export type ConsentType =
  | 'PDN_ADULT'
  | 'PDN_MINOR_GUARDIAN'
  | 'HEALTH_DATA'
  | 'ACTIVITY_WAIVER_ADULT'
  | 'ACTIVITY_WAIVER_MINOR_GUARDIAN'
  | 'MARKETING_MEDIA'
  | 'MARKETING_NEWSLETTER'
  | 'STAFF_PDN'

export interface ConsentTextDef {
  type: ConsentType
  title: string
  body: string
  required: boolean
}

export interface ConsentTexts {
  version: string
  texts: ConsentTextDef[]
}

export interface ConsentStatus {
  type: ConsentType
  granted: boolean
  version: string | null
  updatedAt: string | null
  required: boolean
}

export interface GuardianChild {
  id: string
  clientId: string
  client?: Client
}

export interface Guardian {
  id: string
  fullName: string
  phone: string
  email: string | null
  relation: string
  linkedClientId: string | null
  linkedClient?: Client | null
  children: GuardianChild[]
  createdAt: string
}

export interface TrainerWorkHour {
  id: string
  day: number
  startHour: number
  endHour: number
}
export interface TrainerCredential {
  id: string
  title: string
  issuedBy: string | null
  year: number | null
}
export interface TrainerCompetitionPhoto {
  id: string
  url: string
  caption: string | null
}
export type EmploymentType = 'EMPLOYEE' | 'SELF_EMPLOYED' | 'SOLE_PROPRIETOR'

export interface Trainer {
  id: string
  gymId?: string
  name: string
  avatarHue: number
  specialization: string
  bio: string | null
  fullBio: string | null
  experienceYears: number
  personalSessionPrice: number
  externalUrl: string | null
  workHours: TrainerWorkHour[]
  credentials: TrainerCredential[]
  competitionPhotos: TrainerCompetitionPhoto[]
  employmentType: EmploymentType | null
  revenueSharePercent: number | null
  // Только из списка /trainers (P1.7): нужен CEO-фильтру «тренер работает
  // на выбранной точке» — домашняя ИЛИ дополнительная.
  additionalGyms?: { gymId: string }[]
}

export type MembershipScope = 'SINGLE_GYM' | 'NETWORK'

export interface Membership {
  id: string
  type: MembershipType
  scope: MembershipScope
  purchasedAt: string
  expiresAt: string | null
  visitsTotal: number | null
  visitsLeft: number | null
  status: MembershipStatus
  // Заморозка (P2.1): израсходовано дней лимита в текущем периоде и дата,
  // когда заморозка заканчивается (первый день, когда абонемент снова действует).
  frozenDaysUsed: number
  freezeEndsAt: string | null
}

export interface ClientFormatHistoryEntry {
  id: string
  trainerId: string | null
  format: ClientFormat
  from: string
  to: string | null
  reason: string | null
}

export interface Client {
  id: string
  gymId?: string
  name: string
  gender: Gender
  avatarHue: number
  trainerId: string | null
  trainer?: Trainer | null
  format: ClientFormat
  tariff: Tariff | null
  joinedAt: string
  birthday: string | null
  phone: string | null
  email: string | null
  profilePhotoUrl: string | null
  splitPlan: string[]
  membership: Membership | null
  formatHistory?: ClientFormatHistoryEntry[]
  // null — дата рождения не указана, статус неизвестен (P0.6).
  isMinor: boolean | null
}

// Проход на входе (P2.2): одна запись — один успешный скан QR клиента.
export type CheckinSource = 'QR' | 'MANUAL'

export interface Checkin {
  id: string
  gymId: string
  clientId: string
  client?: { id: string; name: string } | null
  at: string
  source: CheckinSource
}

// Ответ сканера на входе: duplicate=true — повторный скан в окне дебаунса,
// новая запись не создавалась и посещение повторно не списывалось.
export interface CheckinScanResult {
  duplicate: boolean
  checkin: Checkin
  client: {
    id: string
    name: string
    homeGymName: string
    membership: { type: MembershipType; status: MembershipStatus; expiresAt: string | null; visitsLeft: number | null } | null
  }
}

export interface Exercise {
  id: string
  name: string
  muscleGroup: MuscleGroup
  defaultSets: number
  defaultReps: string
  defaultLoad: string
  technique: string | null
  equipment: string | null
  imageUrl: string | null
  imageAttribution: string | null
}

export interface ProgramExerciseEntry {
  id: string
  exerciseId: string
  sets: number
  reps: string
  load: string
  order: number
}
export interface ProgramDay {
  id: string
  label: string
  order: number
  entries: ProgramExerciseEntry[]
}
export interface Program {
  id: string
  clientId: string
  assignedBy: 'trainer' | 'self'
  updatedAt: string
  days: ProgramDay[]
}

export interface WorkoutSetLog {
  id: string
  reps: string
  load: string
  completed: boolean
  effort: EffortLevel | null
  restSeconds: number | null
}
export interface WorkoutExerciseLog {
  id: string
  exerciseId: string
  sets: WorkoutSetLog[]
}
export interface WorkoutLogEntry {
  id: string
  clientId: string
  date: string
  dayLabel: string
  status: WorkoutStatus
  exercises: WorkoutExerciseLog[]
  // Есть в CEO-фиде /workout-logs (P1.7): gymId клиента — основа фильтра
  // посещаемости по точке сети.
  client?: { id: string; name: string; avatarHue: number; gymId: string } | null
}

export interface GroupClassBooking {
  id: string
  clientId: string
}
export interface GroupClass {
  id: string
  gymId: string
  type: string
  trainerId: string
  trainer?: Trainer
  zone: string
  date: string
  start: string
  end: string
  capacity: number
  bookings: GroupClassBooking[]
}

export interface PersonalSlot {
  id: string
  gymId: string
  trainerId: string
  trainer?: Trainer
  date: string
  start: string
  end: string
  clientId: string | null
  client?: Client | null
  status: SlotStatus
}

export interface Locker {
  id: string
  number: number
  status: LockerStatus
  rentedBy: string | null
  rentedUntil: string | null
  pricePerDay: number
}

export interface CatalogItem {
  id: string
  name: string
  category: CatalogCategory
  price: number
  emoji: string
}

export interface MembershipPricing {
  single: number
  monthly: number
  pack10: number
  pack20: number
  singleNetwork: number | null
  monthlyNetwork: number | null
  pack10Network: number | null
  pack20Network: number | null
  personalSingle: number
  personalPack5: number
  groupSingle: number
  groupMonthly: number
}

export interface ClubPostMedia {
  id: string
  kind: 'photo' | 'video'
  url: string
  caption: string | null
}
export interface ClubPost {
  id: string
  date: string
  authorName: string
  authorRole: string
  type: ClubPostType
  title: string
  text: string
  media: ClubPostMedia[]
  likes: number
}

export interface FeedbackMessage {
  id: string
  clientId: string
  from: 'client' | 'trainer'
  date: string
  text: string
}

export interface ProgressPhoto {
  id: string
  clientId: string
  date: string
  kind: ProgressPhotoKind
  mealType: MealType | null
  url: string
  caption: string | null
}

export interface Measurement {
  id: string
  clientId: string
  date: string
  weightKg: number | null
  bodyFatPercent: number | null
  muscleMassKg: number | null
  waterPercent: number | null
  visceralFat: number | null
  chestCm: number | null
  waistCm: number | null
  hipsCm: number | null
}

export interface CycleLog {
  id: string
  clientId: string
  date: string
}

export interface Gym {
  id: string
  name: string
  selfTrainingMinAge: number
  createdAt: string
}

export interface DirectorMessage {
  id: string
  clientId: string
  client?: Client
  date: string
  text: string
  reply: string | null
  repliedAt: string | null
  replySeenByClient: boolean
}
