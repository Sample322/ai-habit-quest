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

    // Route through the Cloudflare Worker proxy when TELEGRAM_API_ROOT is set
    // (same path grammy uses for the bot). Without this the RU backend can't
    // reach api.telegram.org and the request times out indefinitely, hanging
    // the Pay-with-Stars button on the client.
    const apiRoot = (envString('TELEGRAM_API_ROOT', '') || 'https://api.telegram.org').replace(/\/+$/, '');

    let res;
    try {
      res = await axios.post(`${apiRoot}/bot${token}/createInvoiceLink`, {
        title: invoice.title,
        description: invoice.description,
        payload: invoice.payload,
        currency: 'XTR',
        prices: [{ label: invoice.title, amount: invoice.stars }],
      }, { timeout: 15_000 });
    } catch (err) {
      const e = err as { code?: string; message?: string; response?: { data?: unknown } };
      this.logger.error(
        `createInvoiceLink request failed: code=${e.code} msg=${e.message} body=${JSON.stringify(e.response?.data)}`,
      );
      throw new Error(`Telegram createInvoiceLink failed: ${e.message ?? 'request error'}`);
    }

    if (!res.data?.ok) {
      this.logger.error(`createInvoiceLink !ok: ${JSON.stringify(res.data)}`);
      throw new Error(`createInvoiceLink failed: ${JSON.stringify(res.data)}`);
    }
    return { invoiceLink: res.data.result as string, payload: invoice.payload };
  }
}
