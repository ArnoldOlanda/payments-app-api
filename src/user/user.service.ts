import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { In, Repository } from 'typeorm';
import { Role } from 'src/role/entities/role.entity';
import { encryptPassword } from 'src/helpers/encryptPassword';
import { Zone } from 'src/zone/entities/zone.entity';
import { Payment } from 'src/payment/entities/payment.entity';

@Injectable()
export class UserService {
  
  constructor(
    @InjectRepository(User) 
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Zone)
    private readonly zoneRepository: Repository<Zone>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const {zones, ...rest} = createUserDto;
    try {
      const role = await this.roleRepository.findOne({where: {id: createUserDto.role_id}});
    
      if (!role) {
        throw new NotFoundException('Role not found');
      }

      const user = this.userRepository.create({
        ...rest,
        role,
        password: encryptPassword(createUserDto.password)
      });
      
      const savedUser = await this.userRepository.save(user);

      if(zones) {
        await this.assingZones(savedUser.id, zones);
      }

      return savedUser;
    } catch (error:any) {
      if(error.code === '23505') {
        throw new ConflictException('Email already exists');
      }
      throw error;
    }
  }

  findAll() {
    return this.userRepository.find({relations: ['zones']});
  }

  async findCustomers(userId: string) {
    const user = await this.userRepository.findOne({
      where: {id: userId},
      relations: ['zones','zones.customers']
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const customers = user.zones.flatMap(zone => 
      zone.customers.map(customer => ({
        ...customer,
        zone,
        zoneId: zone.id
      }))
    );

    return customers;
  }

  async findOne(id: string) {

    const user = await this.userRepository.findOne({where: {id}});

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.userRepository.findOne({where: {id}});
  }

  async findBy(field: keyof User, value: string) {
    
    return this.userRepository.findOne({
      where: {[field]: value}, 
      select: ['id', 'name', 'email', 'password'],
      relations: ['zones']
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const {zones, ...rest} = updateUserDto;
    
    // if(rest.password.length > 0){ // Si se cambio la contraseña, encriptar
    //   rest.password = encryptPassword(rest.password);
    // } 

    const userZones: Zone[] = [];
    zones.forEach(async(zone) => {
      const zoneFound = await this.zoneRepository.findOne({where: {id: zone}});
      if(!zoneFound) {
        throw new NotFoundException(`Zone with id ${zone} not found`);
      }
      userZones.push(zoneFound);
    });

    const userDb = await this.userRepository.findOne({where: {id}});

    const user = await this.userRepository.preload({
      id,
      ...rest,
      password: rest.password ? encryptPassword(rest.password): userDb.password,
      zones: userZones
    });

    return this.userRepository.save(user);
  }

  async remove(id: string) {
    const user = await this.userRepository.findOne({where: {id}});
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.userRepository.softDelete(id);

    return 'User deleted successfully';
  }

  async assingZones(userId: string, zoneIds: string[]){
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['zones'], 
    });
  
    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }
  
    // Validar las zonas
    const zones = await this.zoneRepository.findBy({id: In(zoneIds)});
  
    if (zones.length !== zoneIds.length) {
      const invalidIds = zoneIds.filter((id) => !zones.find((zone) => zone.id === id));
      throw new NotFoundException(`Zones with ids ${invalidIds.join(', ')} not found`);
    }
  
    // Asignar las zonas al usuario
    user.zones = zones;
  
    // Guardar cambios
    return this.userRepository.save(user);
  }

  async totalPaymentsToday(userId: string) {
    const user = await this.userRepository.findOne({where: {id: userId}});
    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }

    const payments = this.paymentRepository.createQueryBuilder('p')
      .innerJoin('p.account', 'a')
      .innerJoin('a.customer', 'c')
      .innerJoin('c.zone', 'z')
      .select('z.name', 'zone')
      .addSelect('SUM(p.amount)', 'total')
      .where('p.date = CURRENT_DATE')
      .andWhere('p.userId = :userId', { userId })
      .groupBy('z.id')
      .getRawMany();

    return payments;
  }
}
