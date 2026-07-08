import { ExecutionContext, createParamDecorator } from '@nestjs/common';

import { Actor } from 'src/auth/types/actor.type';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Actor => {
    const req = context.switchToHttp().getRequest();
    return req.user as Actor;
  },
);
