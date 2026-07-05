import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  BadRequestException,
  HttpCode,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateAuthDto } from './dto/create-auth.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Request, Response } from 'express';
import { buildCookieOptions } from 'src/helpers/cookieConfig';
import { Throttle } from '@nestjs/throttler';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { PasswordResetService } from './services/password-reset.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordResetService: PasswordResetService,
  ) {}

  @Post('login')
  login(@Body() createAuthDto: CreateAuthDto, @Res() res: Response) {
    return this.authService.validate(createAuthDto, res);
  }

  @Post('refresh-token')
  async refreshToken(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: RefreshTokenDto,
  ) {
    // Dual-channel: web client sends cookie automatically, mobile sends in body
    const refreshToken = req.cookies?.refresh_token || body?.refresh_token;
    if (!refreshToken) {
      throw new BadRequestException('Refresh token not provided');
    }
    const result = await this.authService.refreshToken(refreshToken);
    res.cookie('refresh_token', result.refresh_token, buildCookieOptions());
    return res.status(200).json(result);
  }

  // Rate limit: 3 requests per IP per 15 minutes
  @Throttle({ default: { limit: 3, ttl: 15 * 60 * 1000 } })
  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    await this.passwordResetService.requestReset(
      forgotPasswordDto.email,
      forgotPasswordDto.client,
    );
    // Always 200, regardless of whether the email exists
    return { message: 'If the email exists, a reset link has been sent' };
  }

  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    await this.passwordResetService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.new_password,
    );
    return { message: 'Password has been reset successfully' };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body: RefreshTokenDto,
  ): Promise<{ message: string }> {
    // logout(undefined) is a no-op — safe to always call so the cookie is
    // always cleared even when the caller had no token to revoke.
    const refreshToken = req.cookies?.refresh_token || body?.refresh_token;
    await this.authService.logout(refreshToken);
    res.clearCookie('refresh_token');
    return { message: 'Logged out' };
  }
}
