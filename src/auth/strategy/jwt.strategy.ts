import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/user/entities/user.entity';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), // Extrae el token del encabezado Authorization: Bearer <token>
      ignoreExpiration: false, // Rechaza tokens expirados
      secretOrKey: configService.get<string>('JWT_SECRET'), // Llave secreta o clave de encriptación
    });
  }

  // Este método valida el token decodificado (el payload)
  async validate(payload: { id: string; timezone?: string }) {
    // Aquí podrías hacer más validaciones o cargar el usuario desde la base de datos
    const user = await this.userRepository.findOne({
      where: { id: payload.id },
      relations: ['role'],
    });
    if (!user) {
      throw new UnauthorizedException('Token no válido');
    }
    // The user row's `timezone` column is the source of truth at validate time.
    // For tokens issued before this feature landed (no `timezone` claim), the
    // column default `'UTC'` covers the gap.
    return { ...user, role: user.role.name };
  }
}
