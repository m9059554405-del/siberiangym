import { Injectable, Logger } from '@nestjs/common';

// Абстракция над сетевым контроллером замков (P2.8): бизнес-логика киоска
// не завязана на протокол одного производителя (в процессе упоминался
// Kerong). Реальный драйвер подставляется вместо демо-заглушки в
// LockersModule одним useClass — логика назначения не меняется.
export abstract class LockerControllerDriver {
  // Отправить сигнал открытия конкретной дверцы. Возвращает false, если
  // контроллер не подтвердил команду — вызывающий код не занимает шкафчик.
  abstract open(controllerId: string, channel: number): Promise<boolean>;
}

// Демо-драйвер без железа: команда логируется и «подтверждается» — тот же
// приём, что у EmailService без SMTP и SmsService без провайдера.
@Injectable()
export class LoggingLockerControllerDriver extends LockerControllerDriver {
  private readonly logger = new Logger('LockerController');

  async open(controllerId: string, channel: number): Promise<boolean> {
    this.logger.log(`OPEN: контроллер ${controllerId}, канал ${channel}`);
    return true;
  }
}
