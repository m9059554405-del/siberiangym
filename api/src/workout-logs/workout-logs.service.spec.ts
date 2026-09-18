import { WorkoutLogsService } from './workout-logs.service';

// P3.15: лидерборд кэшируется с TTL — тяжёлый разбор строк подходов
// выполняется не чаще раза в интервал, а не на каждый запрос.

function makeService(logs: unknown[]) {
  const prisma: any = { workoutLogEntry: { findMany: jest.fn().mockResolvedValue(logs) } };
  const gyms: any = {};
  return { service: new WorkoutLogsService(prisma, gyms), prisma };
}

function logOf(clientId: string, name: string, sets: { load: string; reps: string; completed: boolean }[], hue = 210) {
  return { clientId, client: { name, avatarHue: hue }, exercises: [{ sets }] };
}

describe('WorkoutLogsService.leaderboard (P3.15)', () => {
  it('считает кг = вес × повторы (диапазон — по среднему), сортирует по убыванию', async () => {
    const { service } = makeService([
      logOf('c1', 'Анна', [
        { load: '50 кг', reps: '10', completed: true },
        { load: '50 кг', reps: '10', completed: true },
      ]),
      logOf('c2', 'Борис', [
        { load: '100 кг', reps: '8-12', completed: true }, // 100 × 10 = 1000
        { load: '100 кг', reps: '5 мин', completed: true }, // кардио-формат повторов: 100 × 5 = 500
      ]),
      logOf('c3', 'Вера', [
        { load: '30 сек', reps: '40', completed: true }, // без «кг» — не считается
      ]),
    ]);

    const rows = await service.leaderboard('gym1', 'day');
    expect(rows).toEqual([
      { clientId: 'c2', name: 'Борис', avatarHue: 210, kg: 1500 },
      { clientId: 'c1', name: 'Анна', avatarHue: 210, kg: 1000 },
    ]);
  });

  it('невыполненные подходы и cardio без веса исключаются', async () => {
    const { service } = makeService([
      logOf('c1', 'Анна', [
        { load: '80 кг', reps: '8', completed: false },
        { load: '30 сек', reps: '40', completed: true },
      ]),
    ]);
    expect(await service.leaderboard('gym1', 'week')).toEqual([]);
  });

  it('повторный вызов в пределах TTL не обращается к БД повторно', async () => {
    const { service, prisma } = makeService([logOf('c1', 'Анна', [{ load: '60 кг', reps: '10', completed: true }])]);

    await service.leaderboard('gym1', 'day');
    await service.leaderboard('gym1', 'day');
    await service.leaderboard('gym1', 'day');

    expect(prisma.workoutLogEntry.findMany).toHaveBeenCalledTimes(1);
  });

  it('разные периоды — независимые записи кэша (отдельные запросы)', async () => {
    const { service, prisma } = makeService([]);
    await service.leaderboard('gym1', 'day');
    await service.leaderboard('gym1', 'week');
    expect(prisma.workoutLogEntry.findMany).toHaveBeenCalledTimes(2);
  });
});
