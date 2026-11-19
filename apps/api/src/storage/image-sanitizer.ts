import sharp from 'sharp';
import type { ImageMime } from './image-type';

/** Lado máximo en píxeles: una foto de comida no necesita más y ahorra disco y ancho de banda (RNF-08). */
export const MAX_IMAGE_SIDE = 2048;
/** Tope de píxeles de entrada (≈ 48 MP): evita bombas de descompresión (un PNG pequeño que ocupa GB al decodificarse). */
const MAX_INPUT_PIXELS = 48_000_000;

export class InvalidImageError extends Error {}

/**
 * Re-codifica la imagen. Esto:
 *  - elimina TODOS los metadatos (EXIF con GPS del domicilio, modelo del teléfono, fecha, miniaturas incrustadas);
 *  - aplica la orientación EXIF a los píxeles antes de borrarla, para que la foto no se vea girada;
 *  - destruye contenido ajeno oculto en el archivo (polyglots, payloads tras el EOI);
 *  - limita las dimensiones y rechaza archivos corruptos o bombas de descompresión.
 */
export async function sanitizeImage(buffer: Buffer, mime: ImageMime): Promise<Buffer> {
  try {
    const pipeline = sharp(buffer, { failOn: 'error', limitInputPixels: MAX_INPUT_PIXELS, sequentialRead: true })
      .rotate()
      .resize({ width: MAX_IMAGE_SIDE, height: MAX_IMAGE_SIDE, fit: 'inside', withoutEnlargement: true });
    if (mime === 'image/jpeg') return await pipeline.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
    if (mime === 'image/png') return await pipeline.png({ compressionLevel: 9 }).toBuffer();
    return await pipeline.webp({ quality: 85 }).toBuffer();
  } catch {
    throw new InvalidImageError('La imagen está dañada o no se puede procesar');
  }
}
