import {
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'crypto';
import { Response } from 'express';

import { CreateAuthDto } from './dto/create-auth.dto';
import { UserService } from 'src/user/user.service';
import { verifyPassword } from 'src/helpers/verifyPassword';
import { buildCookieOptions } from 'src/helpers/cookieConfig';
import { RefreshToken } from './entities/refresh-token.entity';

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days, matches JWT expiresIn

const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
  ) {}

  async validate(createAuthDto: CreateAuthDto, res: Response) {
    const userByEmail = await this.userService.findBy(
      'email',
      createAuthDto.email,
    );

    if (!userByEmail) {
      throw new UnauthorizedException('Invalid credentials-email');
    }

    const validPassword = verifyPassword(
      createAuthDto.password,
      userByEmail.password,
    );
    if (!validPassword) {
      throw new UnauthorizedException('Invalid credentials-password');
    }

    const payload = { id: userByEmail.id };
    const token = this.generateToken(payload);
    const refreshToken = await this.generateRefreshToken(payload);

    await this.persistRefreshToken(userByEmail.id, refreshToken);

    res.cookie('refresh_token', refreshToken, buildCookieOptions());

    const userSafe: any = { ...userByEmail };
    delete userSafe.password;

    return res.status(HttpStatus.OK).json({
      user: userSafe,
      token,
      refresh_token: refreshToken,
    });
  }

  async refreshToken(rawToken: string) {
    if (!rawToken) {
      throw new UnauthorizedException('Refresh token not provided');
    }

    const stored = await this.refreshTokenRepo.findOne({
      where: { tokenHash: hashToken(rawToken) },
    });
    if (!stored) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (stored.revokedAt !== null) {
      // Reuse detected. Per OWASP, treat the whole chain as compromised:
      // revoke every active token for this user so the attacker cannot ride
      // a still-valid sibling to a fresh token.
      await this.revokeAllForUser(stored.userId);
      this.logger.warn(
        `Refresh-token reuse detected for user ${stored.userId}; all tokens revoked`,
      );
      throw new UnauthorizedException(
        'Refresh token reuse detected; please login again',
      );
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    let payload: { id: string };
    try {
      const verified = await this.jwtService.verifyAsync(rawToken, {
        secret: process.env.REFRESH_TOKEN_SECRET,
      });
      const { exp, iat, ...rest } = verified;
      payload = rest;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.id !== stored.userId) {
      throw new UnauthorizedException('Refresh token user mismatch');
    }

    // One-shot: revoke the consumed token before issuing the next one.
    stored.revokedAt = new Date();
    await this.refreshTokenRepo.save(stored);

    const newAccessToken = this.jwtService.sign(payload);
    const newRefreshToken = await this.generateRefreshToken(payload);
    await this.persistRefreshToken(payload.id, newRefreshToken);

    return { token: newAccessToken, refresh_token: newRefreshToken };
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    const stored = await this.refreshTokenRepo.findOne({
      where: { tokenHash: hashToken(rawToken) },
    });
    if (stored && stored.revokedAt === null) {
      stored.revokedAt = new Date();
      await this.refreshTokenRepo.save(stored);
    }
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.refreshTokenRepo.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  private async persistRefreshToken(
    userId: string,
    rawToken: string,
  ): Promise<void> {
    await this.refreshTokenRepo.save(
      this.refreshTokenRepo.create({
        userId,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        revokedAt: null,
      }),
    );
  }

  private generateToken(payload: { id: string }) {
    return this.jwtService.sign(payload);
  }

  private generateRefreshToken(payload: { id: string }) {
    return this.jwtService.signAsync(payload, {
      secret: process.env.REFRESH_TOKEN_SECRET,
      expiresIn: '7d',
    });
  }
}
