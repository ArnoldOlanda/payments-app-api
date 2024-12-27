import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import { Role } from 'src/role/entities/role.entity';
import { encryptPassword } from 'src/helpers/encryptPassword';

@Injectable()
export class UserService {
  
  constructor(
    @InjectRepository(User) 
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {}

  async create(createUserDto: CreateUserDto) {

    try {
      const role = await this.roleRepository.findOne({where: {id: createUserDto.role_id}});
    
      if (!role) {
        throw new NotFoundException('Role not found');
      }

      const user = this.userRepository.create({
        ...createUserDto,
        role,
        password: encryptPassword(createUserDto.password)
      });
      
      const savedUser = await this.userRepository.save(user);
      return savedUser;
    } catch (error:any) {
      if(error.code === '23505') {
        throw new ConflictException('Email already exists');
      }
      throw error;
    }
  }

  findAll() {
    return this.userRepository.find();
  }

  async findOne(id: string) {

    const user = await this.userRepository.findOne({where: {id}});

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.userRepository.findOne({where: {id}});
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const role = await this.roleRepository.preload({
      id,
      ...updateUserDto
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }
    
    return this.userRepository.save(updateUserDto);
  }

  async remove(id: string) {
    const user = await this.userRepository.findOne({where: {id}});
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.userRepository.softDelete(id);

    return 'User deleted successfully';
  }
}
