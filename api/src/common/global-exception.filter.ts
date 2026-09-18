import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';

// P3.22: единая точка обработки непойманных ошибок HTTP. До этого любая
// не-Nest ошибка (ошибка Prisma, TypeError в сервисе) отдаётся фреймворком
// как голый 500 без деталей в логах — диагностировать падение можно было
// только по stdout-обрывку. Фильтр:
//   - HttpException проходит как есть (у Nest-ошибок уже корректные
//     статус и безопасное сообщение);
//   - всё прочее логируется ЦЕЛИКОМ (стек + путь + метод), а клиенту
//     отдаётся аккуратный 500 без деталей реализации — стек и внутренние
//     сообщения не должны покидать сервер.
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Unhandled');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<{ status: (code: number) => { json: (body: unknown) => void } }>();
    const request = ctx.getRequest<{ method?: string; url?: string }>();

    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    const err = exception instanceof Error ? exception : new Error(String(exception));
    this.logger.error(
      `Необработанная ошибка: ${request.method ?? '?'} ${request.url ?? '?'} — ${err.message}`,
      err.stack,
    );

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Внутренняя ошибка сервера — повторите позже или обратитесь в клуб',
    });
  }
}
