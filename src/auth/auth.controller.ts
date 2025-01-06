import { Controller, Get, Post, Body, Patch, Param, Delete, Req, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateAuthDto } from './dto/create-auth.dto';
import { Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() createAuthDto: CreateAuthDto, @Res() res) {
    return this.authService.validate(createAuthDto, res);
  }

  @Get('refresh-token')
  validateToken(@Req() req: Request) {
    return this.authService.refreshToken(req.cookies.refresh_token);
  }
}
