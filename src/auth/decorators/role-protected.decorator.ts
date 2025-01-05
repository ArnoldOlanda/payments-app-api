import { SetMetadata } from '@nestjs/common';
import { ValidRole } from '../enums/validRoles.enum';

export const META_ROLE = 'role'

export const RoleProtected = (...args: ValidRole[]) => {
    return SetMetadata(META_ROLE, args)
};
