import { INestApplication, NotFoundException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/auth/guards/roles.guard';
import { OrdersService } from '../src/orders/orders.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { ScheduleService } from '../src/schedule/schedule.service';

// P3.1: HTTP smoke/e2e критичного пути авторизации и заказа. По умолчанию
// тест не требует DATABASE_URL: зависимости заменяются моками, а guard
// получает заданный JWT payload. Для live e2e с PostgreSQL это основание,
// которое можно расширить в P3.2/staging.

describe('Auth + orders HTTP (e2e smoke)', () => {
  let app: INestApplication;
  const actor = { sub: 'staff1', gymId: 'gym1', role: 'STAFF' };
  const orders = {
    createOrder: jest.fn().mockResolvedValue({ id: 'order1', status: 'DRAFT', totalAmount: 700 }),
    confirmReceipt: jest.fn().mockResolvedValue({ id: 'order1', status: 'PAID' }),
    findOne: jest.fn(),
  };

  beforeAll(async () => {
    process.env.JWT_SECRET ??= 'e2e-test-secret';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AuthService)
      .useValue({ login: jest.fn().mockResolvedValue({ accessToken: 'token', user: { id: 'user1', role: 'STAFF', gymId: 'gym1' } }) })
      .overrideProvider(OrdersService)
      .useValue(orders)
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(ScheduleService)
      .useValue({})
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: (context: any) => {
        context.switchToHttp().getRequest().user = actor;
        return true;
      } })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    orders.createOrder.mockResolvedValue({ id: 'order1', status: 'DRAFT', totalAmount: 700 });
    orders.confirmReceipt.mockResolvedValue({ id: 'order1', status: 'PAID' });
  });

  it('POST /api/auth/login возвращает токен и блокирует шестую попытку', async () => {
    const body = { email: 'staff@siberiangym.ru', password: 'password' };
    const response = await request(app.getHttpServer()).post('/api/auth/login').send(body).expect(201);

    expect(response.body).toEqual({
      accessToken: 'token',
      user: { id: 'user1', role: 'STAFF', gymId: 'gym1' },
    });

    for (let attempt = 2; attempt <= 5; attempt++) {
      await request(app.getHttpServer()).post('/api/auth/login').send(body).expect(201);
    }
    await request(app.getHttpServer()).post('/api/auth/login').send(body).expect(429);
  });

  it('POST /api/orders проходит через auth guard и вызывает сервис с actor', async () => {
    await request(app.getHttpServer())
      .post('/api/orders')
      .send({ clientId: 'client1', lines: [{ type: 'GROUP_CLASS_BOOKING', refId: 'class1', meta: {} }] })
      .expect(201);

    expect(orders.createOrder).toHaveBeenCalledWith(actor, {
      clientId: 'client1',
      lines: [{ type: 'GROUP_CLASS_BOOKING', refId: 'class1', meta: {} }],
    });
  });

  it('POST /api/orders/:id/confirm-receipt передаёт QR и actor в сервис', async () => {
    await request(app.getHttpServer())
      .post('/api/orders/order1/confirm-receipt')
      .send({ qrRaw: 't=20260914T1530&s=700.00&fn=fn1&i=1&fp=2' })
      .expect(201);

    expect(orders.confirmReceipt).toHaveBeenCalledWith(actor, 'order1', 't=20260914T1530&s=700.00&fn=fn1&i=1&fp=2');
  });

  // P4.1: заказ чужой точки/сети — 404, не 200: scoping по gymId из токена
  // выполняется в сервисе до любого чтения строк.
  it('GET /api/orders/:id чужого зала — 404 вместо утечки существования', async () => {
    orders.findOne = jest.fn().mockRejectedValue(new NotFoundException('Заказ не найден'));
    await request(app.getHttpServer())
      .get('/api/orders/foreign-order')
      .expect(404);
  });
});
