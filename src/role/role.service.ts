import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Role } from './entities/role.entity';
import { Repository } from 'typeorm';

@Injectable()
export class RoleService {

  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {}

  create(createRoleDto: CreateRoleDto) {
    return this.roleRepository.save(createRoleDto);
  }

  findAll() {
    return this.roleRepository.find();
  }

  async findOne(id: string) {
    const role = await this.roleRepository.findOne({where: {id}});
  
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    
    return this.roleRepository.findOne({where: {id}});
  }

  async update(id: string, updateRoleDto: UpdateRoleDto) {
    const role = await this.roleRepository.preload({
      id,
      ...updateRoleDto
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return this.roleRepository.save(role);
  }

  async remove(id: string) {
    const role = await this.roleRepository.findOne({where: {id}});
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    await this.roleRepository.softDelete(id);
    return 'Role deleted successfully';
  }
}
