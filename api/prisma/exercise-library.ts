// Курируемая библиотека упражнений — перенесена из демо-версии
// (project_gym/src/data/exercises.ts) один в один, чтобы у зала сразу
// был осмысленный справочник вместо пустого списка.
import { MuscleGroup } from '@prisma/client';

export interface ExerciseSeed {
  name: string;
  muscleGroup: MuscleGroup;
  defaultSets: number;
  defaultReps: string;
  defaultLoad: string;
  technique: string;
  equipment: string;
}

export const EXERCISE_LIBRARY: ExerciseSeed[] = [
  // Грудь
  { name: 'Жим штанги лёжа', muscleGroup: 'CHEST', defaultSets: 4, defaultReps: '8-10', defaultLoad: '60 кг', technique: 'Лопатки сведены, гриф опускается к нижней части груди, локти ~45° от корпуса.', equipment: 'Штанга, скамья' },
  { name: 'Жим гантелей на наклонной скамье', muscleGroup: 'CHEST', defaultSets: 4, defaultReps: '10-12', defaultLoad: '22 кг', technique: 'Наклон скамьи 30-45°, гантели сводятся вверху без удара друг о друга.', equipment: 'Гантели, скамья' },
  { name: 'Разведение гантелей лёжа', muscleGroup: 'CHEST', defaultSets: 3, defaultReps: '12-15', defaultLoad: '10 кг', technique: 'Лёгкий изгиб в локтях сохраняется на всей амплитуде, растяжка без боли в плече.', equipment: 'Гантели, скамья' },
  { name: 'Отжимания на брусьях', muscleGroup: 'CHEST', defaultSets: 3, defaultReps: '10-15', defaultLoad: 'вес тела', technique: 'Корпус с наклоном вперёд для акцента на грудь, локти в стороны.', equipment: 'Брусья' },
  { name: 'Сведение рук в кроссовере', muscleGroup: 'CHEST', defaultSets: 3, defaultReps: '12-15', defaultLoad: '15 кг', technique: 'Сведение по дуге перед собой, пиковое сокращение 1 сек.', equipment: 'Кроссовер' },
  { name: 'Отжимания от пола', muscleGroup: 'CHEST', defaultSets: 3, defaultReps: '15-20', defaultLoad: 'вес тела', technique: 'Корпус прямой, локти под углом 45°, грудь почти касается пола.', equipment: '-' },
  // Спина
  { name: 'Становая тяга', muscleGroup: 'BACK', defaultSets: 4, defaultReps: '6-8', defaultLoad: '80 кг', technique: 'Спина прямая, гриф скользит вдоль голени, тяга за счёт ног и ягодиц.', equipment: 'Штанга' },
  { name: 'Подтягивания широким хватом', muscleGroup: 'BACK', defaultSets: 4, defaultReps: '6-10', defaultLoad: 'вес тела', technique: 'Подбородок выше перекладины, лопатки сведены в верхней точке.', equipment: 'Турник' },
  { name: 'Тяга штанги в наклоне', muscleGroup: 'BACK', defaultSets: 4, defaultReps: '8-10', defaultLoad: '50 кг', technique: 'Корпус ~45° к полу, тяга к низу живота, без рывка.', equipment: 'Штанга' },
  { name: 'Тяга верхнего блока', muscleGroup: 'BACK', defaultSets: 3, defaultReps: '10-12', defaultLoad: '45 кг', technique: 'Тяга к верху груди, локти вниз, без раскачки корпуса.', equipment: 'Блочный тренажёр' },
  { name: 'Горизонтальная тяга блока', muscleGroup: 'BACK', defaultSets: 3, defaultReps: '10-12', defaultLoad: '50 кг', technique: 'Спина прямая, тяга рукояти к животу, лопатки сводятся в конце.', equipment: 'Блочный тренажёр' },
  { name: 'Гиперэкстензия', muscleGroup: 'BACK', defaultSets: 3, defaultReps: '15-20', defaultLoad: 'вес тела', technique: 'Подъём корпуса до прямой линии, без переразгибания поясницы.', equipment: 'Скамья для гиперэкстензии' },
  // Ноги
  { name: 'Приседания со штангой', muscleGroup: 'LEGS', defaultSets: 4, defaultReps: '8-10', defaultLoad: '70 кг', technique: 'Колени по направлению носков, таз назад-вниз, бёдра параллельно полу.', equipment: 'Штанга, стойки' },
  { name: 'Жим ногами в тренажёре', muscleGroup: 'LEGS', defaultSets: 4, defaultReps: '10-12', defaultLoad: '120 кг', technique: 'Колени не заходят за носки, полная амплитуда без отрыва таза.', equipment: 'Тренажёр' },
  { name: 'Румынская тяга', muscleGroup: 'LEGS', defaultSets: 3, defaultReps: '10-12', defaultLoad: '50 кг', technique: 'Ноги почти прямые, штанга скользит по бедру, растяжка задней поверхности.', equipment: 'Штанга' },
  { name: 'Выпады с гантелями', muscleGroup: 'LEGS', defaultSets: 3, defaultReps: '12 на ногу', defaultLoad: '14 кг', technique: 'Колено передней ноги над носком, заднее колено почти касается пола.', equipment: 'Гантели' },
  { name: 'Сгибание ног лёжа', muscleGroup: 'LEGS', defaultSets: 3, defaultReps: '12-15', defaultLoad: '35 кг', technique: 'Таз плотно прижат к скамье, сгибание без рывка.', equipment: 'Тренажёр' },
  { name: 'Разгибание ног сидя', muscleGroup: 'LEGS', defaultSets: 3, defaultReps: '12-15', defaultLoad: '40 кг', technique: 'Разгибание до полного выпрямления, пауза 1 сек в верхней точке.', equipment: 'Тренажёр' },
  { name: 'Подъём на носки стоя', muscleGroup: 'LEGS', defaultSets: 4, defaultReps: '15-20', defaultLoad: '40 кг', technique: 'Полная амплитуда, растяжка икры внизу, пауза вверху.', equipment: 'Тренажёр Смита' },
  { name: 'Гоблет-приседания', muscleGroup: 'LEGS', defaultSets: 3, defaultReps: '12-15', defaultLoad: '16 кг', technique: 'Гиря/гантель у груди, локти внутри колен в нижней точке.', equipment: 'Гиря' },
  // Плечи
  { name: 'Жим гантелей сидя', muscleGroup: 'SHOULDERS', defaultSets: 4, defaultReps: '8-10', defaultLoad: '16 кг', technique: 'Спина плотно к скамье, гантели не сталкиваются в верхней точке.', equipment: 'Гантели, скамья' },
  { name: 'Махи гантелями в стороны', muscleGroup: 'SHOULDERS', defaultSets: 3, defaultReps: '12-15', defaultLoad: '8 кг', technique: 'Лёгкий изгиб локтей, подъём до уровня плеч без рывка.', equipment: 'Гантели' },
  { name: 'Жим штанги стоя', muscleGroup: 'SHOULDERS', defaultSets: 4, defaultReps: '8-10', defaultLoad: '35 кг', technique: 'Пресс напряжён, гриф движется строго вертикально мимо лица.', equipment: 'Штанга' },
  { name: 'Тяга штанги к подбородку', muscleGroup: 'SHOULDERS', defaultSets: 3, defaultReps: '10-12', defaultLoad: '25 кг', technique: 'Локти ведут движение и идут выше кистей.', equipment: 'Штанга' },
  { name: 'Махи в наклоне на задние дельты', muscleGroup: 'SHOULDERS', defaultSets: 3, defaultReps: '12-15', defaultLoad: '6 кг', technique: 'Корпус параллельно полу, махи назад-в стороны.', equipment: 'Гантели' },
  // Руки
  { name: 'Подъём штанги на бицепс', muscleGroup: 'ARMS', defaultSets: 3, defaultReps: '10-12', defaultLoad: '25 кг', technique: 'Локти прижаты к корпусу, без раскачки, полная амплитуда.', equipment: 'Штанга' },
  { name: 'Молотковые сгибания', muscleGroup: 'ARMS', defaultSets: 3, defaultReps: '12', defaultLoad: '12 кг', technique: 'Нейтральный хват, локти статичны, движение только в предплечье.', equipment: 'Гантели' },
  { name: 'Французский жим', muscleGroup: 'ARMS', defaultSets: 3, defaultReps: '10-12', defaultLoad: '20 кг', technique: 'Локти неподвижны, гриф опускается за голову, растяжка трицепса.', equipment: 'EZ-гриф' },
  { name: 'Разгибание рук на блоке', muscleGroup: 'ARMS', defaultSets: 3, defaultReps: '12-15', defaultLoad: '25 кг', technique: 'Локти прижаты к корпусу, полное разгибание с паузой.', equipment: 'Блочный тренажёр' },
  { name: 'Отжимания узким хватом', muscleGroup: 'ARMS', defaultSets: 3, defaultReps: '12-15', defaultLoad: 'вес тела', technique: 'Кисти под грудью, локти движутся вдоль корпуса.', equipment: '-' },
  // Пресс
  { name: 'Скручивания на римском стуле', muscleGroup: 'ABS', defaultSets: 3, defaultReps: '15-20', defaultLoad: 'вес тела', technique: 'Скручивание за счёт пресса, поясница прижата.', equipment: 'Скамья' },
  { name: 'Подъём ног в висе', muscleGroup: 'ABS', defaultSets: 3, defaultReps: '12-15', defaultLoad: 'вес тела', technique: 'Подъём без раскачки, таз слегка подкручивается вверху.', equipment: 'Турник' },
  { name: 'Планка', muscleGroup: 'ABS', defaultSets: 3, defaultReps: '45 сек', defaultLoad: 'вес тела', technique: 'Прямая линия от плеч до пяток, таз не проваливается.', equipment: '-' },
  { name: 'Русские скручивания', muscleGroup: 'ABS', defaultSets: 3, defaultReps: '20 (по 10 на сторону)', defaultLoad: '6 кг', technique: 'Корпус под 45°, повороты за счёт косых мышц.', equipment: 'Диск/гиря' },
  { name: 'Скручивания на блоке', muscleGroup: 'ABS', defaultSets: 3, defaultReps: '15', defaultLoad: '30 кг', technique: 'Скручивание корпуса вниз к бёдрам, таз неподвижен.', equipment: 'Блочный тренажёр' },
  // Кардио
  { name: 'Бег на дорожке', muscleGroup: 'CARDIO', defaultSets: 1, defaultReps: '20 мин', defaultLoad: 'пульс 130-150', technique: 'Равномерный темп, приземление на середину стопы.', equipment: 'Беговая дорожка' },
  { name: 'Гребной тренажёр', muscleGroup: 'CARDIO', defaultSets: 1, defaultReps: '15 мин', defaultLoad: '20 уд/мин', technique: 'Тяга ногами → корпусом → руками, возврат в обратном порядке.', equipment: 'Гребной тренажёр' },
  { name: 'Велотренажёр', muscleGroup: 'CARDIO', defaultSets: 1, defaultReps: '25 мин', defaultLoad: 'уровень 8', technique: 'Седло по высоте бедра, каденс 80-90 об/мин.', equipment: 'Велотренажёр' },
  { name: 'Скакалка', muscleGroup: 'CARDIO', defaultSets: 5, defaultReps: '1 мин', defaultLoad: '-', technique: 'Прыжки на низкой амплитуде, приземление на носки.', equipment: 'Скакалка' },
  { name: 'Берпи', muscleGroup: 'CARDIO', defaultSets: 4, defaultReps: '15', defaultLoad: 'вес тела', technique: 'Присед-упор лёжа-отжимание-прыжок вверх без пауз.', equipment: '-' },
  { name: 'Эллиптический тренажёр', muscleGroup: 'CARDIO', defaultSets: 1, defaultReps: '20 мин', defaultLoad: 'уровень 6', technique: 'Плавное движение без ударной нагрузки на суставы.', equipment: 'Эллипсоид' },
  // Дополнительно
  { name: 'Становая тяга на прямых ногах', muscleGroup: 'LEGS', defaultSets: 3, defaultReps: '10-12', defaultLoad: '40 кг', technique: 'Минимальный изгиб коленей, акцент на заднюю поверхность бедра.', equipment: 'Штанга' },
  { name: 'Жим Арнольда', muscleGroup: 'SHOULDERS', defaultSets: 3, defaultReps: '10', defaultLoad: '12 кг', technique: 'Разворот кистей от себя к вверх при подъёме гантелей.', equipment: 'Гантели' },
  { name: 'Тяга Т-грифа', muscleGroup: 'BACK', defaultSets: 3, defaultReps: '10-12', defaultLoad: '40 кг', technique: 'Корпус фиксирован под углом, тяга к груди/животу.', equipment: 'Т-гриф' },
  { name: 'Жим в тренажёре Смита', muscleGroup: 'CHEST', defaultSets: 3, defaultReps: '10-12', defaultLoad: '50 кг', technique: 'Траектория грифа фиксирована, контроль негативной фазы.', equipment: 'Тренажёр Смита' },
  { name: 'Сгибание рук на скамье Скотта', muscleGroup: 'ARMS', defaultSets: 3, defaultReps: '10-12', defaultLoad: '18 кг', technique: 'Плечо плотно прижато к пюпитру, без читинга.', equipment: 'Скамья Скотта' },
  { name: 'Кубинский жим', muscleGroup: 'SHOULDERS', defaultSets: 3, defaultReps: '12', defaultLoad: '7 кг', technique: 'Протяжка-ротация-жим одним плавным движением.', equipment: 'Гантели' },
  { name: 'Боковая планка', muscleGroup: 'ABS', defaultSets: 3, defaultReps: '30 сек на сторону', defaultLoad: 'вес тела', technique: 'Тело прямой линией, таз не провисает.', equipment: '-' },
  { name: 'Приседания в тренажёре Смита', muscleGroup: 'LEGS', defaultSets: 4, defaultReps: '10-12', defaultLoad: '60 кг', technique: 'Стопы чуть впереди грифа для вертикальной траектории.', equipment: 'Тренажёр Смита' },
  { name: 'Шраги со штангой', muscleGroup: 'BACK', defaultSets: 3, defaultReps: '12-15', defaultLoad: '40 кг', technique: 'Подъём плеч строго вверх, без вращения.', equipment: 'Штанга' },
];
