import { isDispatcherInstance } from './dispatcher';

// P3.18: фоновые задачи выполняет только воркер 0 PM2-кластера; вне PM2
// (dev/одиночный контейнер) — единственный процесс, как раньше.

function withEnv(value: string | undefined, fn: () => void) {
  const prev = process.env.NODE_APP_INSTANCE;
  if (value === undefined) delete process.env.NODE_APP_INSTANCE;
  else process.env.NODE_APP_INSTANCE = value;
  try {
    fn();
  } finally {
    if (prev === undefined) delete process.env.NODE_APP_INSTANCE;
    else process.env.NODE_APP_INSTANCE = prev;
  }
}

describe('isDispatcherInstance (P3.18)', () => {
  it('вне PM2 переменной нет — процесс является диспетчером', () => {
    withEnv(undefined, () => expect(isDispatcherInstance()).toBe(true));
  });

  it('воркер 0 — диспетчер', () => {
    withEnv('0', () => expect(isDispatcherInstance()).toBe(true));
  });

  it('воркеры 1..N — не диспетчеры', () => {
    withEnv('1', () => expect(isDispatcherInstance()).toBe(false));
    withEnv('3', () => expect(isDispatcherInstance()).toBe(false));
  });
});

describe('Фоновые сервисы уважают диспетчер-гейт (P3.18)', () => {
  it('NotificationsService: у воркера ≠ 0 таймер тика не создаётся', async () => {
    const { NotificationsService } = await import('../notifications/notifications.service');
    const prisma: any = { appSetting: { findUnique: jest.fn() }, pushSubscription: {}, clientNotification: {} };
    const service = new NotificationsService(prisma, { send: jest.fn() } as never, { send: jest.fn() } as never);
    withEnv('1', () => service.onModuleInit());
    expect((service as unknown as { timer: unknown }).timer).toBeNull();
    withEnv('0', () => service.onModuleInit());
    expect((service as unknown as { timer: unknown }).timer).not.toBeNull();
    service.onModuleDestroy();
  });
});
