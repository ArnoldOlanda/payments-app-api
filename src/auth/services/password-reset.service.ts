import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';

import { PasswordResetToken } from '../entities/password-reset-token.entity';
import { User } from 'src/user/entities/user.entity';
import { MailService } from 'src/mail/mail.service';
import { AuthService } from '../auth.service';
import { encryptPassword } from 'src/helpers/encryptPassword';
import { PasswordResetClient } from '../dto/forgot-password.dto';

const TOKEN_BYTES = 32; // 256 bits of entropy
const DEFAULT_TTL_SECONDS = 3600; // 1 hour

const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    @InjectRepository(PasswordResetToken)
    private readonly tokenRepo: Repository<PasswordResetToken>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly mailService: MailService,
    private readonly authService: AuthService,
  ) {}

  async requestReset(
    email: string,
    client: PasswordResetClient,
  ): Promise<void> {
    // Always query the DB so timing is constant whether the user exists or not.
    const user = await this.userRepo.findOne({ where: { email } });

    if (!user) {
      // Run a dummy hash to keep CPU cost similar and avoid revealing existence
      // via timing side-channels. We deliberately do NOT send any email here.
      hashToken('dummy-token-to-keep-timing-constant');
      return;
    }

    const rawToken = crypto.randomBytes(TOKEN_BYTES).toString('base64url');
    const tokenHash = hashToken(rawToken);
    const ttlSeconds =
      Number(process.env.RESET_TOKEN_TTL_SECONDS) || DEFAULT_TTL_SECONDS;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    const token = this.tokenRepo.create({
      userId: user.id,
      tokenHash,
      expiresAt,
      usedAt: null,
    });
    await this.tokenRepo.save(token);

    try {
      await this.mailService.sendPasswordResetEmail(
        user.email,
        rawToken,
        client,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email for user ${user.id}`,
        error as Error,
      );
      // Swallow the error: we still want to return 200 so attackers can't probe
      // email validity via the error response.
    }
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = hashToken(rawToken);
    const token = await this.tokenRepo.findOne({ where: { tokenHash } });

    const isUsable =
      !!token &&
      token.usedAt === null &&
      token.expiresAt.getTime() > Date.now();

    if (!isUsable) {
      throw new BadRequestException('Invalid or expired token');
    }

    const user = await this.userRepo.findOne({ where: { id: token.userId } });
    if (!user) {
      throw new BadRequestException('Invalid or expired token');
    }

    user.password = encryptPassword(newPassword);
    await this.userRepo.save(user);

    token.usedAt = new Date();
    await this.tokenRepo.save(token);

    // Invalidate all active refresh tokens for this user so any attacker
    // holding a previously-issued refresh token can no longer mint new
    // sessions after the credential change.
    await this.authService.revokeAllForUser(user.id);

    this.logger.log(`Password reset successful for user ${user.id}`);
  }
}
