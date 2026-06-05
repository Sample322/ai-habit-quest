import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, Logger } from '@nestjs/common';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';

// Origins allowed to make cross-origin XHR/fetch to the backend. Locked to
// the production web app + the Telegram WebView origins that may proxy the
// initData login call. Override per-deploy via ALLOWED_ORIGINS (comma-sep).
const DEFAULT_ALLOWED_ORIGINS = [
  'https://sample322-ai-habit-quest-0676.twc1.net',
  'https://web.telegram.org',
  'https://k.web.telegram.org',
  'https://a.web.telegram.org',
  'https://z.web.telegram.org',
];

function allowedOrigins(): string[] {
  const fromEnv = process.env.ALLOWED_ORIGINS;
  if (!fromEnv) return DEFAULT_ALLOWED_ORIGINS;
  return fromEnv.split(',').map((o) => o.trim()).filter(Boolean);
}

async function bootstrap() {
  // bodyParser: false disables Nest's built-in 100kB express.json/urlencoded
  // so we can mount our own with a larger limit (share endpoint accepts
  // base64-encoded PNGs, validated/capped at 800kB after decode in the
  // controller — JSON-encoded body can hit ~1.2MB).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: false,
    bodyParser: false,
  });
  app.use(json({ limit: '3mb' }));
  app.use(urlencoded({ limit: '3mb', extended: true }));

  // Behind Timeweb's Caddy reverse proxy: trust the first hop so `req.ip`
  // resolves to the real client (via X-Forwarded-For) — required for per-client
  // rate limiting instead of throttling everyone under Caddy's single IP.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // Security headers via Helmet. CSP is configured here at the API level
  // (mainly defence-in-depth — the API serves JSON, not HTML — but the
  // /share/i/:id.png endpoint serves images). The web app's own CSP is
  // enforced by nginx in web/nginx.conf.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'none'"],
          imgSrc: ["'self'", 'data:'],
          // Allow the API to be embedded only by the Telegram WebView /
          // our web app — `frame-ancestors` instead of legacy X-Frame-Options.
          frameAncestors: ["'none'"],
        },
      },
      // Strict-Transport-Security: enforce HTTPS for a year.
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: false },
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // share PNG
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      // X-Powered-By: removed; helmet does this by default.
    }),
  );

  // CORS — explicit allow-list instead of reflect-any-origin. We don't rely
  // on cookies, so credentials are off: that lets the browser accept
  // exact-origin matches without the "credentialed wildcard" restriction.
  const origins = allowedOrigins();
  app.enableCors({
    origin: (origin, cb) => {
      // Allow no-Origin requests (server-to-server, curl, native fetch on
      // the same host) — those carry no CORS guarantees anyway.
      if (!origin) return cb(null, true);
      if (origins.includes(origin)) return cb(null, true);
      Logger.warn(`CORS denied origin=${origin}`, 'Bootstrap');
      return cb(new Error(`Origin ${origin} not allowed`), false);
    },
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Type'],
    maxAge: 86400,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  );

  const port = Number(process.env.BACKEND_PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
  Logger.log(`AHQ backend listening on :${port}`, 'Bootstrap');
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal bootstrap error', err);
  process.exit(1);
});
