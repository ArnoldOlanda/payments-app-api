import { HttpStatus, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { CreateAuthDto } from './dto/create-auth.dto';
import { UpdateAuthDto } from './dto/update-auth.dto';
import { JwtService } from '@nestjs/jwt';
import { UserService } from 'src/user/user.service';
import { verifyPassword } from 'src/helpers/verifyPassword';
import { Response } from 'express';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService
  ) {}

  async validate(createAuthDto: CreateAuthDto, res: Response) {
    const userByEmail = await this.userService.findBy('email', createAuthDto.email);
    
    if(!userByEmail) {
      throw new UnauthorizedException('Invalid credentials-email');
    }

    const validPassword = verifyPassword(createAuthDto.password, userByEmail.password);
    if(!validPassword) {
      throw new UnauthorizedException('Invalid credentials-password');
    }

    const payload = { id: userByEmail.id };
    const token = this.generateToken(payload);
    const refreshToken = await this.generateRefreshToken(payload);

    // Set refresh token cookie http-only
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'prod',
      sameSite: 'none',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });

    return res.status(HttpStatus.OK).json({
      user: userByEmail,
      token 
    });
  }

  private generateToken(payload: { id: string  }) {
    return this.jwtService.sign(payload);
  }

  async refreshToken(refresh_token: string) {
    try {
      const data = await this.jwtService.verifyAsync(refresh_token,{
        secret: process.env.REFRESH_TOKEN_SECRET
      });
      this.logger.log('Refresh token verificado');

      const { exp, iat, ...payload } = data;
      const newAccessToken = await this.jwtService.signAsync(payload);

      return { token: newAccessToken };
    } catch (error) {
      this.logger.error('Error al verificar el token', error);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private generateRefreshToken(payload: any) {
    return this.jwtService.signAsync(payload, {
      secret: process.env.REFRESH_TOKEN_SECRET,
      expiresIn: '7d',
    });
  }
}
