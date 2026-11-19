import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ContentService } from './content.service';

const row = (over: object = {}) => ({
  id: 'k1', title: 'Hidratación', description: null, category: 'TIPS', type: 'ARTICLE', body: 'Toma agua', videoId: null,
  thumbnailAssetId: null, published: false, createdById: 'c1', createdAt: new Date(), updatedAt: new Date(), ...over,
});

function setup() {
  const tx: any = {
    content: { create: jest.fn().mockImplementation(async ({ data }: any) => row(data)), findUnique: jest.fn(), update: jest.fn().mockImplementation(async ({ data }: any) => row(data)), delete: jest.fn() },
    mediaAsset: { findFirst: jest.fn().mockResolvedValue({ id: 'a1' }) },
  };
  const prisma: any = {
    $transaction: jest.fn(async (arg: any) => (typeof arg === 'function' ? arg(tx) : Promise.all(arg))),
    content: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn() },
  };
  const audit: any = { record: jest.fn() };
  return { service: new ContentService(prisma, audit), prisma, tx, audit };
}
const coach: any = { id: 'c1', role: 'COACH' };
const member: any = { id: 'u1', role: 'USER' };
const q = (over: object = {}) => ({ page: 1, limit: 10, sortOrder: 'desc', ...over }) as any;

describe('ContentService (HU-33)', () => {
  it('crea un artículo, descarta el video y audita', async () => {
    const { service, tx, audit } = setup();
    await service.create('c1', { title: 'Hidratación', category: 'TIPS', type: 'ARTICLE', body: 'Toma agua', video: 'dQw4w9WgXcQ', published: false } as any);
    expect(tx.content.create.mock.calls[0][0].data).toMatchObject({ body: 'Toma agua', videoId: null, createdById: 'c1', published: false });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'CONTENT_CREATED' }), tx);
  });

  it('crea un video guardando solo el ID de YouTube', async () => {
    const { service, tx } = setup();
    await service.create('c1', { title: 'Técnica', category: 'VIDEOS', type: 'VIDEO', body: 'ignorado', video: 'dQw4w9WgXcQ', published: true } as any);
    expect(tx.content.create.mock.calls[0][0].data).toMatchObject({ videoId: 'dQw4w9WgXcQ', body: null, published: true });
  });

  it('rechaza una miniatura que no es de la Coach', async () => {
    const { service, tx } = setup();
    tx.mediaAsset.findFirst.mockResolvedValue(null);
    await expect(service.create('c1', { title: 'a', category: 'TIPS', type: 'ARTICLE', body: 'x', thumbnailAssetId: 'zz', published: false } as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.mediaAsset.findFirst.mock.calls[0][0].where).toEqual({ id: 'zz', ownerId: 'c1' });
  });

  it('publicar audita CONTENT_PUBLISHED y despublicar CONTENT_UNPUBLISHED', async () => {
    const { service, tx, audit } = setup();
    tx.content.findUnique.mockResolvedValue(row({ published: false }));
    await service.update('c1', 'k1', { published: true } as any);
    expect(audit.record).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'CONTENT_PUBLISHED' }), tx);
    tx.content.findUnique.mockResolvedValue(row({ published: true }));
    await service.update('c1', 'k1', { published: false } as any);
    expect(audit.record).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'CONTENT_UNPUBLISHED' }), tx);
  });

  it('cambiar de artículo a video exige el enlace; con enlace limpia el cuerpo', async () => {
    const { service, tx } = setup();
    tx.content.findUnique.mockResolvedValue(row());
    await expect(service.update('c1', 'k1', { type: 'VIDEO' } as any)).rejects.toBeInstanceOf(BadRequestException);
    await service.update('c1', 'k1', { type: 'VIDEO', video: 'dQw4w9WgXcQ' } as any);
    expect(tx.content.update.mock.calls[0][0].data).toMatchObject({ type: 'VIDEO', videoId: 'dQw4w9WgXcQ', body: null });
  });

  it('no se puede vaciar el texto de un artículo', async () => {
    const { service, tx } = setup();
    tx.content.findUnique.mockResolvedValue(row());
    await expect(service.update('c1', 'k1', { body: null } as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('editar o eliminar algo inexistente → 404', async () => {
    const { service, tx } = setup();
    tx.content.findUnique.mockResolvedValue(null);
    await expect(service.update('c1', 'x', { title: 'a' } as any)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove('c1', 'x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('eliminar audita con el título', async () => {
    const { service, tx, audit } = setup();
    tx.content.findUnique.mockResolvedValue({ id: 'k1', title: 'Hidratación' });
    await service.remove('c1', 'k1');
    expect(tx.content.delete).toHaveBeenCalledWith({ where: { id: 'k1' } });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'CONTENT_DELETED', metadata: { title: 'Hidratación' } }), tx);
  });

  it('la usuaria solo lista contenido publicado, aunque pida borradores', async () => {
    const { service, prisma } = setup();
    await service.list(member, q({ published: 'false' }));
    expect(prisma.content.findMany.mock.calls[0][0].where).toEqual({ published: true });
  });

  it('la Coach ve todo y puede filtrar', async () => {
    const { service, prisma } = setup();
    await service.list(coach, q({ published: 'false', category: 'TIPS', search: 'agua' }));
    expect(prisma.content.findMany.mock.calls[0][0].where).toEqual({ published: false, category: 'TIPS', title: { contains: 'agua', mode: 'insensitive' } });
  });

  it('un borrador para la usuaria → 404; para la Coach → lo ve', async () => {
    const { service, prisma } = setup();
    prisma.content.findFirst.mockResolvedValue(null);
    await expect(service.get(member, 'k1')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.content.findFirst.mock.calls[0][0].where).toEqual({ id: 'k1', published: true });
    prisma.content.findFirst.mockResolvedValue(row());
    await service.get(coach, 'k1');
    expect(prisma.content.findFirst.mock.calls[1][0].where).toEqual({ id: 'k1' });
  });
});
