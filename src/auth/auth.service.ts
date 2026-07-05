import {
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateAuthDto } from './dto/create-auth.dto';
import { UpdateAuthDto } from './dto/update-auth.dto';
import { JwtService } from '@nestjs/jwt';
import { UserService } from 'src/user/user.service';
import { verifyPassword } from 'src/helpers/verifyPassword';
import { buildCookieOptions } from 'src/helpers/cookieConfig';
import { Response } from 'express';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
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

    // Set refresh token cookie httpOnly for web clients (mobile ignores cookies)
    res.cookie('refresh_token', refreshToken, buildCookieOptions());

    // Defense-in-depth: strip password before serializing.
    // ClassSerializerInterceptor + @Exclude on entity is the second layer.
    const userSafe: any = { ...userByEmail };
    delete userSafe.password;

    return res.status(HttpStatus.OK).json({
      user: userSafe,
      token,
      refresh_token: refreshToken,
    });
  }

  async refreshToken(refresh_token: string) {
    try {
      const data = await this.jwtService.verifyAsync(refresh_token, {
        secret: process.env.REFRESH_TOKEN_SECRET,
      });
      this.logger.log('Refresh token verificado');

      const { exp, iat, ...payload } = data;
      const newAccessToken = await this.jwtService.signAsync(payload);
      const newRefreshToken = await this.generateRefreshToken(payload);

      return { token: newAccessToken, refresh_token: newRefreshToken };
    } catch (error) {
      this.logger.error('Error al verificar el token', error);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private generateToken(payload: { id: string }) {
    return this.jwtService.sign(payload);
  }

  private generateRefreshToken(payload: any) {
    return this.jwtService.signAsync(payload, {
      secret: process.env.REFRESH_TOKEN_SECRET,
      expiresIn: '7d',
    });
  }
}
