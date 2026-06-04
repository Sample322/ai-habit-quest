import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, Logger } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

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

  // CORS — explicit config so the Telegram WebView (which serves the Mini
  // App from `*.twc1.net`) can call our backend on a different `*.twc1.net`
  // host. We don't rely on cookies, so credentials are off: that lets the
  // browser accept reflected origins without the "credentialed wildcard"
  // restriction. The Authorization header is allow-listed for our JWT bearer.
  app.enableCors({
    origin: true,
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
