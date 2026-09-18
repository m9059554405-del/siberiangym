import { HttpException, HttpStatus } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';

// P3.22: HttpException проходит как есть; неизвестная ошибка логируется
// целиком, а наружу уходит безопасный 500 без стека и внутренних деталей.

function run(filter: GlobalExceptionFilter, exception: unknown) {
  const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const host: any = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ method: 'POST', url: '/api/orders' }),
    }),
  };
  filter.catch(exception, host);
  return response;
}

describe('GlobalExceptionFilter (P3.22)', () => {
  it('Nest HttpException проходит без изменений', () => {
    const filter = new GlobalExceptionFilter();
    const exception = new HttpException('Место занято', HttpStatus.CONFLICT);
    const response = run(filter, exception);

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith('Место занято');
  });

  it('неизвестная ошибка — 500 с безопасным сообщением, без стека', () => {
    const filter = new GlobalExceptionFilter();
    const error = new Error('secret internals: connection string postgres://user:pass@...');
    const response = run(filter, error);

    expect(response.status).toHaveBeenCalledWith(500);
    const body = response.json.mock.calls[0][0] as { statusCode: number; message: string };
    expect(body.statusCode).toBe(500);
    expect(body.message).not.toContain('postgres://');
    expect(body.message).not.toContain('secret');
  });

  it('не-Error объект не роняет фильтр', () => {
    const filter = new GlobalExceptionFilter();
    const response = run(filter, 'странная ошибка');
    expect(response.status).toHaveBeenCalledWith(500);
  });
});
