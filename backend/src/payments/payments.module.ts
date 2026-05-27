import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { YooKassaProvider } from './yookassa.provider';
import { TelegramStarsProvider } from './stars.provider';

@Module({
  providers: [PaymentsService, YooKassaProvider, TelegramStarsProvider],
  controllers: [PaymentsController],
  exports: [PaymentsService],
})
export class PaymentsModule {}
