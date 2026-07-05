import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Role } from 'src/role/entities/role.entity';
import { User } from 'src/user/entities/user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class SeedService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async executeSeed() {
    await this.roleRepository.insert({ name: 'Admin' });
    await this.roleRepository.insert({ name: 'Prestamista' });

    await this.userRepository.insert({
      name: 'Admin',
      email: 'admin@email.com',
      password: 'admin',
      role: await this.roleRepository.findOne({ where: { name: 'Admin' } }),
    });

    await this.userRepository.insert({
      name: 'Prestamista',
      email: 'prestamista@email.com',
      password: 'prestamista',
      role: await this.roleRepository.findOne({
        where: { name: 'Prestamista' },
      }),
    });

    return `Seed executed successfully`;
  }
}
