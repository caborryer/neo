import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { StorageService } from './storage.service';

@Global()
@Module({
  imports: [
    MulterModule.registerAsync({
      inject: [ConfigService],
      // Memoria + límite de tamaño: el archivo se valida por contenido antes de tocar el disco.
      useFactory: (config: ConfigService) => ({ limits: { fileSize: (config.get<number>('MAX_UPLOAD_MB') ?? 5) * 1024 * 1024, files: 1 } }),
    }),
  ],
  controllers: [MediaController],
  providers: [StorageService, MediaService],
  exports: [StorageService, MediaService],
})
export class StorageModule {}
