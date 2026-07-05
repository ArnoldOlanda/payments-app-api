import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator';

export enum PasswordResetClient {
  Web = 'web',
  Mobile = 'mobile',
}

export class ForgotPasswordDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsEnum(PasswordResetClient, {
    message: 'client must be either "web" or "mobile"',
  })
  client: PasswordResetClient;
}
