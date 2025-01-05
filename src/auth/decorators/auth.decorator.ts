import { applyDecorators, UseGuards } from '@nestjs/common';
import { ValidRole } from '../enums/validRoles.enum';
import { RoleProtected } from './role-protected.decorator';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from '../guards/user-role.guard';

export function Auth(...roles: ValidRole[]) {
  return applyDecorators(
    RoleProtected(...roles),
    UseGuards(AuthGuard('jwt'), UserRoleGuard),
  );
}
