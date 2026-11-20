import { MailService, maskEmail } from './mail.service';

const config = (over: Record<string, unknown> = {}) => ({ get: (k: string) => ({ WEB_ORIGIN: 'https://neo.example.com', MAIL_FROM: 'neoTRAINING <no-reply@neo.example.com>', ...over })[k] }) as any;

describe('MailService · Resend (API HTTPS)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('envía por la API de Resend con la clave en Authorization y el enlace con el token', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"id":"1"}', { status: 200 }));
    const mail = new MailService(config({ MAIL_PROVIDER: 'resend', RESEND_API_KEY: 're_secret' }));
    await expect(mail.sendInvitation('ana@mail.com', 'Ana', 'tok en/1')).resolves.toBe(true);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.resend.com/emails');
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer re_secret');
    const body = JSON.parse(init!.body as string);
    expect(body).toMatchObject({ from: 'neoTRAINING <no-reply@neo.example.com>', to: ['ana@mail.com'] });
    expect(body.text).toContain('https://neo.example.com/reset-password?token=tok%20en%2F1&invitation=1');
  });

  it('un error del proveedor no rompe la operación: devuelve false y no filtra el correo completo en el log', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"message":"bad"}', { status: 403 }));
    const mail = new MailService(config({ MAIL_PROVIDER: 'resend', RESEND_API_KEY: 're_secret' }));
    const logged: string[] = [];
    jest.spyOn((mail as any).logger, 'error').mockImplementation((m: unknown) => void logged.push(String(m)));
    await expect(mail.sendPasswordReset('ana@mail.com', 'Ana', 't')).resolves.toBe(false);
    expect(logged[0]).toContain('a***@mail.com');
    expect(logged[0]).not.toContain('ana@mail.com');
    expect(logged[0]).not.toContain('re_secret');
  });

  it('maskEmail', () => {
    expect(maskEmail('ana@mail.com')).toBe('a***@mail.com');
  });
});
