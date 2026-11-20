import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import { invitationEmail, resetPasswordEmail } from './templates';

/** a***@dominio.com: los logs no deben guardar correos completos (datos personales). */
export const maskEmail = (email: string): string => email.replace(/^(.).*(@.*)$/, '$1***$2');

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;
  private readonly webOrigin: string;
  private readonly provider: 'smtp' | 'resend';
  private readonly resendKey?: string;

  constructor(config: ConfigService) {
    this.provider = config.get<'smtp' | 'resend'>('MAIL_PROVIDER') ?? 'smtp';
    this.resendKey = config.get<string>('RESEND_API_KEY');
    this.transporter = createTransport({
      host: config.get<string>('SMTP_HOST') ?? 'localhost',
      port: config.get<number>('SMTP_PORT') ?? 1025,
      secure: config.get<boolean>('SMTP_SECURE') ?? false,
      auth: config.get<string>('SMTP_USER') ? { user: config.get<string>('SMTP_USER')!, pass: config.get<string>('SMTP_PASSWORD') ?? '' } : undefined,
    });
    this.from = config.get<string>('MAIL_FROM') ?? 'Neo <no-reply@neo.local>';
    this.webOrigin = (config.get<string>('WEB_ORIGIN') ?? 'http://localhost:5173').replace(/\/$/, '');
  }

  sendInvitation(to: string, firstName: string, token: string): Promise<boolean> {
    const link = `${this.webOrigin}/reset-password?token=${encodeURIComponent(token)}&invitation=1`;
    return this.send(to, invitationEmail(firstName, link));
  }

  sendPasswordReset(to: string, firstName: string, token: string): Promise<boolean> {
    const link = `${this.webOrigin}/reset-password?token=${encodeURIComponent(token)}`;
    return this.send(to, resetPasswordEmail(firstName, link));
  }

  /** Un fallo de envío nunca rompe la operación principal: se registra y se devuelve false. */
  private async send(to: string, content: { subject: string; html: string; text: string }): Promise<boolean> {
    try {
      if (this.provider === 'resend') return await this.sendWithResend(to, content);
      await this.transporter.sendMail({ from: this.from, to, ...content });
      return true;
    } catch (err) {
      // Nunca se registra el contenido (contiene el enlace con el token).
      this.logger.error(`No se pudo enviar el correo a ${maskEmail(to)}: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }

  /**
   * Envío por API HTTPS (Resend). Railway bloquea SMTP (25/465/587/2525) fuera del plan Pro, así que allí es la vía por defecto.
   * Nunca se registra el cuerpo de la respuesta de error con el contenido del mensaje.
   */
  private async sendWithResend(to: string, content: { subject: string; html: string; text: string }): Promise<boolean> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: this.from, to: [to], subject: content.subject, html: content.html, text: content.text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Resend respondió ${res.status}`);
    return true;
  }
}
