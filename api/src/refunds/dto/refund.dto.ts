import { IsNotEmpty, IsString } from 'class-validator';

export class RequestRefundDto {
  @IsString()
  @IsNotEmpty({ message: 'Укажите причину возврата' })
  reason!: string;
}

export class ConfirmRefundReceiptDto {
  @IsString()
  qrRaw!: string;
}
