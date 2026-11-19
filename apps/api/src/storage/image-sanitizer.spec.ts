import sharp from 'sharp';
import { InvalidImageError, MAX_IMAGE_SIDE, sanitizeImage } from './image-sanitizer';

const base = (w = 40, h = 20) => sharp({ create: { width: w, height: h, channels: 3, background: '#c33' } });

describe('sanitizeImage (privacidad y archivos maliciosos)', () => {
  it('elimina el EXIF (GPS, cámara, fecha) de una foto JPEG', async () => {
    const original = await base().jpeg().withExif({ IFD0: { Copyright: 'Casa de Andrea, Calle 1 #2-3' } }).toBuffer();
    expect((await sharp(original).metadata()).exif).toBeDefined();

    const clean = await sanitizeImage(original, 'image/jpeg');
    const meta = await sharp(clean).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.format).toBe('jpeg');
    expect(clean.toString('latin1')).not.toContain('Casa de Andrea');
  });

  it('aplica la orientación EXIF a los píxeles antes de borrarla (la foto no queda girada)', async () => {
    const rotada = await base(40, 20).jpeg().withMetadata({ orientation: 6 }).toBuffer(); // 40×20 con "girar 90°"
    const clean = await sanitizeImage(rotada, 'image/jpeg');
    const meta = await sharp(clean).metadata();
    expect([meta.width, meta.height]).toEqual([20, 40]);
    expect(meta.orientation).toBeUndefined();
  });

  it('descarta datos ocultos tras el final de la imagen (polyglot)', async () => {
    const png = await base().png().toBuffer();
    const polyglot = Buffer.concat([png, Buffer.from('<?php system($_GET["c"]); ?>')]);
    const clean = await sanitizeImage(polyglot, 'image/png');
    expect(clean.toString('latin1')).not.toContain('<?php');
  });

  it('reduce las imágenes enormes al lado máximo sin ampliar las pequeñas', async () => {
    const grande = await base(MAX_IMAGE_SIDE * 2, 100).png().toBuffer();
    expect((await sharp(await sanitizeImage(grande, 'image/png')).metadata()).width).toBe(MAX_IMAGE_SIDE);
    const pequena = await base(30, 30).webp().toBuffer();
    expect((await sharp(await sanitizeImage(pequena, 'image/webp')).metadata()).width).toBe(30);
  });

  it('rechaza archivos con cabecera de imagen pero contenido corrupto', async () => {
    const roto = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(50, 7)]);
    await expect(sanitizeImage(roto, 'image/jpeg')).rejects.toBeInstanceOf(InvalidImageError);
  });
});
