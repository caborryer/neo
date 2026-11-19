import { Body, Controller, HttpCode, Logger, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  type ChangePasswordInput,
  type ForgotPasswordInput,
  type LoginInput,
  type ResetPasswordInput,
} from '@neo/validation';
import { CurrentUser, Public } from '../common/decorators';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { toAuthUser } from '../users/user.mapper';
import { ACCESS_COOKIE, REFRESH_COOKIE, REFRESH_COOKIE_PATH } from './auth.constants';
import { AuthService, SessionTokens } from './auth.service';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post('login')
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, tokens } = await this.auth.login(body.email, body.password, this.client(req));
    this.setCookies(res, tokens);
    return toAuthUser(user);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(200)
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    try {
      const { user, tokens } = await this.auth.refresh(token, this.client(req));
      this.setCookies(res, tokens);
      return toAuthUser(user);
    } catch (err) {
      this.clearCookies(res);
      throw err;
    }
  }

  @Public()
  @HttpCode(204)
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout((req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE]);
    this.clearCookies(res);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @HttpCode(200)
  @Post('forgot-password')
  async forgotPassword(@Body(new ZodValidationPipe(forgotPasswordSchema)) body: ForgotPasswordInput) {
    // El trabajo (buscar, crear token, enviar correo) corre en segundo plano: si se esperara, la respuesta tardaría
    // más cuando el correo existe y eso permitiría descubrir qué correos están registrados (enumeración por tiempo).
    void this.auth.forgotPassword(body.email).catch((err: unknown) => this.logger.error(`forgot-password falló: ${err instanceof Error ? err.message : String(err)}`));
    // Siempre la misma respuesta (HU-02): no revela si el correo existe.
    return { message: 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.' };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('reset-password')
  async resetPassword(@Body(new ZodValidationPipe(resetPasswordSchema)) body: ResetPasswordInput) {
    await this.auth.resetPassword(body.token, body.password);
    return { message: 'Tu contraseña fue actualizada. Ya puedes iniciar sesión.' };
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post('change-password')
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(changePasswordSchema)) body: ChangePasswordInput,
    @Req() req: Request,
  ) {
    await this.auth.changePassword(user.id, body.currentPassword, body.newPassword, (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE]);
    return { message: 'Tu contraseña fue actualizada.' };
  }

  private client(req: Request) {
    return { userAgent: req.get('user-agent') ?? undefined, ip: req.ip };
  }

  private cookieBase(): CookieOptions {
    const secure = this.config.get<boolean | undefined>('COOKIE_SECURE') ?? this.config.get('NODE_ENV') === 'production';
    return { httpOnly: true, sameSite: 'lax', secure };
  }

  private setCookies(res: Response, t: SessionTokens): void {
    res.cookie(ACCESS_COOKIE, t.accessToken, { ...this.cookieBase(), path: '/', maxAge: t.accessMaxAgeMs });
    res.cookie(REFRESH_COOKIE, t.refreshToken, {
      ...this.cookieBase(),
      path: REFRESH_COOKIE_PATH,
      maxAge: t.refreshMaxAgeMs,
    });
  }

  private clearCookies(res: Response): void {
    res.clearCookie(ACCESS_COOKIE, { ...this.cookieBase(), path: '/' });
    res.clearCookie(REFRESH_COOKIE, { ...this.cookieBase(), path: REFRESH_COOKIE_PATH });
  }
}
