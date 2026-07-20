import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cache } from 'cache-manager';

import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { PaginationDto } from './dto/pagination.dto';
import { AccountService } from 'src/account/account.service';
import { Zone } from 'src/zone/entities/zone.entity';
import { Customer } from './entities/customer.entity';

@Injectable()
export class CustomerService {
  //logger
  private readonly logger = new Logger(CustomerService.name);
  private readonly cacheKeys = new Set<string>();

  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Zone) private readonly zoneRepository: Repository<Zone>,
    private readonly accountService: AccountService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async create(createCustomerDto: CreateCustomerDto) {
    try {
      let zone = null;
      if (createCustomerDto.zoneId) {
        zone = await this.zoneRepository.findOne({
          where: { id: createCustomerDto.zoneId },
        });
        if (!zone)
          throw new NotFoundException(
            `Zone with id ${createCustomerDto.zoneId} not found`,
          );
      }
      const customer = this.customerRepository.create({
        ...createCustomerDto,
        zone,
      });

      const savedCustomer = await this.customerRepository.save(customer);
      await this.invalidateCache();
      return savedCustomer;
    } catch (error) {
      if (error.code === '23505') {
        throw new ConflictException('El correo o el documento ya esta en uso');
      }
      throw error;
    }
  }

  async findAll(paginationDto: PaginationDto): Promise<any> {
    // Crear una clave única para esta consulta basada en los parámetros
    const cacheKey = `customers:${JSON.stringify(paginationDto)}`;

    // Verificar si tenemos estos resultados en caché
    const cachedData = await this.cacheManager.get(cacheKey);

    if (cachedData) {
      this.logger.log('Returning cached data');
      return cachedData;
    }

    const { zoneId, search, page = 1, limit = 10, all = false } = paginationDto;

    // Usar QueryBuilder para manejar correctamente las condiciones OR
    const queryBuilder = this.customerRepository
      .createQueryBuilder('customer')
      .leftJoinAndSelect('customer.zone', 'zone');

    // Añadir condición de zona si se proporciona
    if (zoneId) {
      queryBuilder.andWhere('zone.id = :zoneId', { zoneId });
    }

    // Añadir condiciones de búsqueda si se proporciona
    if (search) {
      const searchValue = `%${search}%`;
      queryBuilder.andWhere(
        '(customer.documentNumber ILIKE :search OR ' +
          'customer.name ILIKE :search OR ' +
          'customer.lastName ILIKE :search OR ' +
          'customer.address ILIKE :search OR ' +
          'customer.phone ILIKE :search OR ' +
          'customer.email ILIKE :search)',
        { search: searchValue },
      );
    }

    // Si all=true, devolver todos los resultados sin paginar pero manteniendo el mismo shape
    if (all) {
      const [data, total] = await queryBuilder.getManyAndCount();
      const result = {
        data,
        total,
        page: 1,
        limit: total,
        lastPage: 1,
      };
      await this.cacheManager.set(cacheKey, result);
      this.cacheKeys.add(cacheKey);
      return result;
    }

    // Validar que page y limit sean positivos
    const validPage = Math.max(1, page);
    const validLimit = Math.max(1, limit);
    const skip = (validPage - 1) * validLimit;

    // Añadir paginación
    queryBuilder.skip(skip).take(validLimit);

    // Ejecutar la consulta
    const [data, total] = await queryBuilder.getManyAndCount();

    const result = {
      data,
      total,
      page: validPage,
      limit: validLimit,
      lastPage: Math.ceil(total / validLimit),
    };

    // Guardar en caché los resultados
    await this.cacheManager.set(cacheKey, result);
    this.cacheKeys.add(cacheKey);

    return result;
  }

  async findOne(id: string) {
    const customer = await this.customerRepository.findOne({ where: { id } });

    if (!customer) throw new NotFoundException('Customer not found');

    return customer;
  }

  async findCredits(id: string) {
    const customer = await this.customerRepository.findOne({
      where: { id },
      relations: ['accounts'],
    });

    if (!customer) throw new NotFoundException('Customer not found');

    return customer.accounts;
  }

  async update(id: string, updateCustomerDto: UpdateCustomerDto) {
    if (
      updateCustomerDto.zoneId !== undefined &&
      updateCustomerDto.zoneId !== null
    ) {
      const zone = await this.zoneRepository.findOne({
        where: { id: updateCustomerDto.zoneId },
      });

      if (!zone) throw new NotFoundException('Zone not found');
    }

    const customer = await this.customerRepository.preload({
      id,
      ...updateCustomerDto,
    });

    if (!customer) throw new NotFoundException('Customer not found');

    await this.invalidateCache();
    return await this.customerRepository.save(customer);
  }

  async remove(id: string) {
    const customer = await this.customerRepository.findOne({
      where: { id },
      relations: ['accounts'],
    });

    if (!customer) throw new NotFoundException('Customer not found');

    //Delete all accounts and payments
    await Promise.all(
      customer.accounts.map((account) =>
        this.accountService.remove(account.id),
      ),
    );

    await this.invalidateCache();
    await this.customerRepository.softDelete(id);

    return 'Customer deleted successfully';
  }

  // Método para invalidar la caché cuando se crea, actualiza o elimina un cliente
  async invalidateCache(): Promise<void> {
    const keys = Array.from(this.cacheKeys);
    this.cacheKeys.clear();
    await Promise.all(keys.map((key) => this.cacheManager.del(key)));
  }
}
