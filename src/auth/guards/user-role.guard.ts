import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { User } from 'src/user/entities/user.entity';
import { META_ROLE } from '../decorators/role-protected.decorator';

@Injectable()
export class UserRoleGuard implements CanActivate {

  constructor(
    private readonly reflector: Reflector,
  ) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const validRoles:string[] = this.reflector.get<string[]>(META_ROLE, context.getHandler());

    
    if(!validRoles) return true;
    if(validRoles.length === 0) return true;
    
    const req = context.switchToHttp().getRequest();
    const user = req.user as User & { role: string };    
    
    if (!validRoles.includes(user.role)) {
      throw new ForbiddenException('This route is only accessible by users with the following roles: ' + validRoles.join(', '));
    }
  
    return true;
  }
}
