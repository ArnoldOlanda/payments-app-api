import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { CreateAuthDto } from './dto/create-auth.dto';
import { UpdateAuthDto } from './dto/update-auth.dto';
import { JwtService } from '@nestjs/jwt';
import { UserService } from 'src/user/user.service';
import { verifyPassword } from 'src/helpers/verifyPassword';

@Injectable()
export class AuthService {

  constructor(
    private readonly userService: UserService,

    private readonly jwtService: JwtService
  ) {}

  async validate(createAuthDto: CreateAuthDto) {
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

    return {
      user: userByEmail,
      token 
    };
  }

  private generateToken(payload: { id: string  }) {
    return this.jwtService.sign(payload);
  }
}
