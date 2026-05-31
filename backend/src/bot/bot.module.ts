import { Module, forwardRef } from '@nestjs/common';
import { BotService } from './bot.service';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [forwardRef(() => PaymentsModule)],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}
