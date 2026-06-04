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
      // For Telegram Stars (currency=XTR) provider_token MUST be an empty
      // string — otherwise the Bot API returns PROVIDER_ACCOUNT_INVALID when
      // the invoice link is opened in the client.
      // Ref: https://core.telegram.org/bots/payments-stars
      res = await axios.post(`${apiRoot}/bot${token}/createInvoiceLink`, {
        title: invoice.title,
        description: invoice.description,
        payload: invoice.payload,
        provider_token: '',
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

  /**
   * Card-payment invoice via Telegram Bot Payments. The provider_token comes
   * from BotFather → bot → Payments → selected provider (e.g. ЮKassa).
   * Currency=RUB, amount in kopecks. Telegram routes the payment through the
   * provider; we get a successful_payment update via the bot webhook.
   */
  async createCardInvoiceLink(invoice: {
    title: string;
    description: string;
    payload: string;
    amountRub: number;
  }): Promise<StarsInvoiceResult> {
    const token = envString('TELEGRAM_BOT_TOKEN', '');
    const providerToken = envString('YOOKASSA_PROVIDER_TOKEN', '');
    if (!token || !providerToken) {
      this.logger.warn('Card payments disabled — no bot token or provider token');
      return {
        invoiceLink: `tg://mock-card-invoice?payload=${encodeURIComponent(invoice.payload)}`,
        payload: invoice.payload,
      };
    }

    const apiRoot = (envString('TELEGRAM_API_ROOT', '') || 'https://api.telegram.org').replace(/\/+$/, '');
    let res;
    try {
      res = await axios.post(
        `${apiRoot}/bot${token}/createInvoiceLink`,
        {
          title: invoice.title,
          description: invoice.description,
          payload: invoice.payload,
          provider_token: providerToken,
          currency: 'RUB',
          // YooKassa requires the receipt object for digital goods; pass it
          // via provider_data so Telegram forwards it to the provider.
          provider_data: JSON.stringify({
            receipt: {
              items: [
                {
                  description: 'AI Habit Quest Premium · 1 month',
                  quantity: '1.00',
                  amount: { value: invoice.amountRub.toFixed(2), currency: 'RUB' },
                  vat_code: 1, // VAT-free / no VAT
                },
              ],
            },
          }),
          prices: [{ label: invoice.title, amount: invoice.amountRub * 100 }],
        },
        { timeout: 15_000 },
      );
    } catch (err) {
      const e = err as { code?: string; message?: string; response?: { data?: unknown } };
      this.logger.error(
        `createCardInvoiceLink request failed: code=${e.code} msg=${e.message} body=${JSON.stringify(e.response?.data)}`,
      );
      throw new Error(`Telegram createCardInvoiceLink failed: ${e.message ?? 'request error'}`);
    }

    if (!res.data?.ok) {
      this.logger.error(`createCardInvoiceLink !ok: ${JSON.stringify(res.data)}`);
      throw new Error(`createCardInvoiceLink failed: ${JSON.stringify(res.data)}`);
    }
    return { invoiceLink: res.data.result as string, payload: invoice.payload };
  }
}
