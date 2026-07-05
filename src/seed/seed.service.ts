import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Role } from 'src/role/entities/role.entity';
import { User } from 'src/user/entities/user.entity';
import { encryptPassword } from 'src/helpers/encryptPassword';

@Injectable()
export class SeedService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async executeSeed() {
    await this.roleRepository
      .createQueryBuilder()
      .insert()
      .into(Role)
      .values([{ name: 'Admin' }, { name: 'Prestamista' }])
      .orIgnore()
      .execute();

    const adminRole = await this.roleRepository.findOne({
      where: { name: 'Admin' },
    });
    const prestamistaRole = await this.roleRepository.findOne({
      where: { name: 'Prestamista' },
    });

    await this.userRepository
      .createQueryBuilder()
      .insert()
      .into(User)
      .values([
        {
          name: 'Admin',
          email: 'admin@email.com',
          password: encryptPassword('admin12345'),
          role: adminRole,
        },
        {
          name: 'Prestamista',
          email: 'prestamista@email.com',
          password: encryptPassword('prestamista'),
          role: prestamistaRole,
        },
      ])
      .orIgnore()
      .execute();

    return `Seed executed successfully`;
  }
}