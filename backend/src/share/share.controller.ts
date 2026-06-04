import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  NotFoundException,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsOptional, IsString } from 'class-validator';
import type { Response } from 'express';

import { JwtAuthGuard, CurrentUser } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { envString } from '../config/env';

class UploadShareDto {
  @IsString()
  dataUrl!: string; // expected: "data:image/png;base64,...."

  @IsOptional() @IsString()
  mime?: string;
}

// Generous: a 1080×1350 canvas PNG with gradients can hit ~1.2MB even with
// max zlib compression. Body-parser limit (3MB) is what stops abuse.
const MAX_PNG_BYTES = 1_800_000;

@Controller('share')
export class ShareController {
  private readonly logger = new Logger(ShareController.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Upload a base64-encoded progress card PNG and get back a public URL.
   * Used by the web client so Telegram's shareToStory has a fetchable image.
   * Caps body to ~800kB after decode so we can't be turned into a free CDN.
   */
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('progress')
  async upload(
    @CurrentUser() me: AuthenticatedUser,
    @Body() body: UploadShareDto,
  ): Promise<{ id: string; url: string }> {
    const inputLen = body?.dataUrl?.length ?? 0;
    this.logger.log(`upload by user=${me.id} dataUrl.len=${inputLen}`);

    const match = /^data:([\w/+.-]+);base64,(.+)$/i.exec(body.dataUrl.trim());
    if (!match) {
      this.logger.warn(`upload rejected: malformed dataUrl, len=${inputLen}`);
      throw new BadRequestException('dataUrl must be data:<mime>;base64,...');
    }
    const mime = body.mime || match[1] || 'image/png';
    if (!mime.startsWith('image/')) {
      this.logger.warn(`upload rejected: bad mime=${mime}`);
      throw new BadRequestException('Only image mime types accepted');
    }

    const buf = Buffer.from(match[2], 'base64');
    if (buf.byteLength === 0) {
      this.logger.warn('upload rejected: empty after decode');
      throw new BadRequestException('Empty image');
    }
    if (buf.byteLength > MAX_PNG_BYTES) {
      this.logger.warn(`upload rejected: too large bytes=${buf.byteLength} max=${MAX_PNG_BYTES}`);
      throw new BadRequestException(`Image too large (max ${MAX_PNG_BYTES} bytes)`);
    }

    const row = await this.prisma.shareImage.create({
      data: { userId: me.id, data: buf, mime },
      select: { id: true },
    });

    const base = envString('PUBLIC_API_BASE', '').replace(/\/+$/, '');
    const url = base
      ? `${base}/share/i/${row.id}.png`
      : `/share/i/${row.id}.png`;
    this.logger.log(`upload ok id=${row.id} bytes=${buf.byteLength}`);
    return { id: row.id, url };
  }

  /** Public image endpoint — anyone with the id can pull the PNG. */
  @Get('i/:id.png')
  async fetchImage(@Param('id') id: string, @Res() res: Response): Promise<void> {
    const row = await this.prisma.shareImage.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Image not found');
    res.setHeader('Content-Type', row.mime);
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    res.send(row.data);
  }
}
