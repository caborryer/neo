import { Controller, Get, Header, Param, ParseUUIDPipe, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { MediaService, type UploadedImage } from './media.service';

@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  /** Cualquier usuario autenticado puede subir imágenes propias (foto de comida, perfil). */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('images')
  @UseInterceptors(FileInterceptor('file'))
  upload(@CurrentUser() user: AuthenticatedUser, @UploadedFile() file: UploadedImage | undefined) {
    return this.media.uploadImage(user, file);
  }

  @Get(':id')
  @Header('Cache-Control', 'private, max-age=3600')
  async download(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Res({ passthrough: true }) res: Response) {
    const { file, mimeType } = await this.media.open(user, id);
    res.setHeader('Content-Type', mimeType);
    return file;
  }
}
