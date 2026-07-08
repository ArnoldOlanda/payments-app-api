import { User } from 'src/user/entities/user.entity';

export type Actor = User & { role: string };
