import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

import { envString, envBool } from '../config/env';

export interface StarsInvoice {
  title: string;
  description: string;
  payload: string; // arbitrary string we will echo back to ourselves
  stars: number;   // price in Stars
}

export interface StarsInvoiceResult {
  invoiceLink: string;
  payload: string;
}

/**
 * Telegram Stars invoice link generation for digital goods inside a Mini App.
 * Uses Bot API `createInvoiceLink` with currency=XTR.
 * See https://core.telegram.org/bots/payments-stars
 */
@Injectable()
export class TelegramStarsProvider {
  private readonly logger = new Logger(TelegramStarsProvider.name);

  isEnabled(): boolean {
    return envBool('TELEGRAM_STARS_ENABLED', false);
  }

  async createInvoiceLink(invoice: StarsInvoice): Promise<StarsInvoiceResult> {
    const token = envString('TELEGRAM_BOT_TOKEN', '');
    if (!this.isEnabled() || !token) {
      this.logger.warn('Telegram Stars disabled or no bot token — returning mock invoice link');
      return {
        invoiceLink: `tg://mock-invoice?payload=${encodeURIComponent(invoice.payload)}`,
        payload: invoice.payload,
      };
    }

    const res = await axios.post(`https://api.telegram.org/bot${token}/createInvoiceLink`, {
      title: invoice.title,
      description: invoice.description,
      payload: invoice.payload,
      currency: 'XTR',
      prices: [{ label: invoice.title, amount: invoice.stars }],
    });

    if (!res.data?.ok) throw new Error(`createInvoiceLink failed: ${JSON.stringify(res.data)}`);
    return { invoiceLink: res.data.result as string, payload: invoice.payload };
  }
}
