import { BadRequestException, NotFoundException } from '@nestjs/common';
import { detectImageMime } from './image-type';
import { MediaService } from './media.service';
import { StorageService } from './storage.service';

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(20)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20)]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(8)]);

describe('detección de tipo de imagen (§9.2)', () => {
  it('reconoce JPG, PNG y WebP por su contenido', () => {
    expect(detectImageMime(JPEG)).toBe('image/jpeg');
    expect(detectImageMime(PNG)).toBe('image/png');
    expect(detectImageMime(WEBP)).toBe('image/webp');
  });
  it('rechaza HTML, SVG, GIF y archivos vacíos aunque se llamen .jpg', () => {
    expect(detectImageMime(Buffer.from('<html><script>alert(1)</script></html>'))).toBeNull();
    expect(detectImageMime(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(detectImageMime(Buffer.from('GIF89a......'))).toBeNull();
    expect(detectImageMime(Buffer.alloc(0))).toBeNull();
  });
});

describe('StorageService', () => {
  const storage = new StorageService({ get: () => '/tmp/neo-test-storage' } as any);
  it('rechaza claves que intentan salir del directorio', () => {
    for (const key of ['../etc/passwd', '..%2f..', 'a/b.jpg', '', 'x.exe', '11111111-1111-4111-8111-111111111111.svg']) {
      expect(() => storage.open(key)).toThrow('Clave de almacenamiento inválida');
    }
  });
});

describe('MediaService', () => {
  const owner: any = { id: 'u1', role: 'USER', privacyConsentAt: new Date() };
  function setup() {
    const prisma: any = { mediaAsset: { create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 'a1', ...data })), findUnique: jest.fn() } };
    const storage: any = { save: jest.fn().mockResolvedValue('k.jpg'), remove: jest.fn(), open: jest.fn().mockReturnValue(require('node:stream').Readable.from([])) };
    const service = new MediaService(prisma, storage, { get: () => 1 } as any); // máximo 1 MB
    return { service, prisma, storage };
  }
  const file = (buffer: Buffer, over: object = {}) => ({ buffer, originalname: 'comida.jpg', size: buffer.length, ...over });

  it('guarda con nombre aleatorio, registra el asset y devuelve una URL autenticada', async () => {
    const { service, prisma, storage } = setup();
    const dto = await service.uploadImage(owner, file(JPEG, { originalname: '../../evil name!.jpg' }));
    expect(storage.save).toHaveBeenCalledWith(JPEG, 'jpg');
    expect(prisma.mediaAsset.create.mock.calls[0][0].data).toMatchObject({ ownerId: 'u1', mimeType: 'image/jpeg', storageKey: 'k.jpg' });
    expect(prisma.mediaAsset.create.mock.calls[0][0].data.fileName).not.toContain('/');
    expect(dto).toMatchObject({ id: 'a1', url: '/api/v1/media/a1' });
  });
  it('HU-28: una usuaria sin consentimiento no puede subir fotos; la Coach sí', async () => {
    const { service, storage } = setup();
    await expect(service.uploadImage({ id: 'u1', role: 'USER', privacyConsentAt: null } as any, file(JPEG))).rejects.toThrow('política de privacidad');
    expect(storage.save).not.toHaveBeenCalled();
    await expect(service.uploadImage({ id: 'c1', role: 'COACH', privacyConsentAt: null } as any, file(JPEG))).resolves.toBeDefined();
  });
  it('rechaza sin archivo, demasiado grande o de otro formato (sin guardar nada)', async () => {
    const { service, storage } = setup();
    await expect(service.uploadImage(owner, undefined)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.uploadImage(owner, file(JPEG, { size: 2 * 1024 * 1024 }))).rejects.toThrow('máximo');
    await expect(service.uploadImage(owner, file(Buffer.from('<html>')))).rejects.toThrow('Formato no permitido');
    expect(storage.save).not.toHaveBeenCalled();
  });
  it('si falla el registro en BD borra el archivo guardado', async () => {
    const { service, prisma, storage } = setup();
    prisma.mediaAsset.create.mockRejectedValue(new Error('db'));
    await expect(service.uploadImage(owner, file(PNG))).rejects.toThrow('db');
    expect(storage.remove).toHaveBeenCalledWith('k.jpg');
  });
  it('una usuaria no abre la imagen de otra (404); la Coach sí', async () => {
    const { service, prisma } = setup();
    prisma.mediaAsset.findUnique.mockResolvedValue({ id: 'a1', ownerId: 'otra', storageKey: 'k.jpg', mimeType: 'image/jpeg' });
    await expect(service.open(owner, 'a1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.open({ id: 'c1', role: 'COACH' } as any, 'a1')).resolves.toMatchObject({ mimeType: 'image/jpeg' });
    prisma.mediaAsset.findUnique.mockResolvedValue(null);
    await expect(service.open(owner, 'zz')).rejects.toBeInstanceOf(NotFoundException);
  });
});
