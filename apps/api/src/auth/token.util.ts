import { createHash, randomBytes } from 'crypto';

/** Token opaco de 32 bytes (256 bits) en base64url. */
export const generateToken = (): string => randomBytes(32).toString('base64url');

/** En la BD solo se guarda el hash; el token en claro nunca se persiste. */
export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');
