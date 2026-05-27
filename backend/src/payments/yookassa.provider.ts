import { Injectable, Logger } from '@nestjs/common';

import { envString } from '../config/env';

export interface YooKassaCreatePayment {
  amountRub: number;
  description: string;
  userId: string;
  savePaymentMethod: boolean;
  returnUrl: string;
}

export interface YooKassaPaymentResult {
  externalId: string;
  confirmationUrl: string;
  paymentMethodId?: string;
  status: 'pending' | 'succeeded' | 'failed';
}

/**
 * Thin YooKassa adapter. With empty credentials it returns a mock confirmation
 * URL so the UI flow can be developed before the merchant account is ready.
 * When YOOKASSA_SHOP_ID + YOOKASSA_SECRET_KEY are set, this will call YooKassa
 * REST API — implementation deferred to Phase 3 against real test credentials.
 */
@Injectable()
export class YooKassaProvider {
  private readonly logger = new Logger(YooKassaProvider.name);

  isConfigured(): boolean {
    return Boolean(envString('YOOKASSA_SHOP_ID', '') && envString('YOOKASSA_SECRET_KEY', ''));
  }

  async createPayment(input: YooKassaCreatePayment): Promise<YooKassaPaymentResult> {
    if (!this.isConfigured()) {
      this.logger.warn('YooKassa credentials missing — returning mock payment');
      return {
        externalId: `mock_${Date.now()}_${input.userId.slice(0, 8)}`,
        confirmationUrl: `${input.returnUrl}?mock=1&amount=${input.amountRub}`,
        status: 'pending',
      };
    }
    // TODO Phase 3: POST https://api.yookassa.ru/v3/payments with idempotence header,
    // shop_id basic auth, save_payment_method, capture: true, etc.
    throw new Error('YooKassa real integration not yet implemented — Phase 3');
  }

  async charge(paymentMethodId: string, amountRub: number, description: string): Promise<YooKassaPaymentResult> {
    if (!this.isConfigured()) {
      return {
        externalId: `mock_charge_${Date.now()}`,
        confirmationUrl: '',
        paymentMethodId,
        status: 'succeeded',
      };
    }
    void description;
    void amountRub;
    throw new Error('YooKassa recurring charge not yet implemented — Phase 3');
  }
}
