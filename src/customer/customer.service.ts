import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { PaginationDto } from './dto/pagination.dto';
import { AccountService } from 'src/account/account.service';
import { Zone } from 'src/zone/entities/zone.entity';
import { Customer } from './entities/customer.entity';
import { ValidRole } from 'src/auth/enums/validRoles.enum';
import { Actor } from 'src/auth/types/actor.type';
import { loadUserZoneIds } from 'src/auth/helpers/zone-scope.helper';

const isAdmin = (user: Actor): boolean => user.role === ValidRole.ADMIN;

@Injectable()
export class CustomerService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Zone) private readonly zoneRepository: Repository<Zone>,
    private readonly accountService: AccountService,
    private readonly dataSource: DataSource,
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
      return savedCustomer;
    } catch (error: any) {
      if (error.code === '23505') {
        throw new ConflictException('El correo o el documento ya esta en uso');
      }
      throw error;
    }
  }

  async findAll(paginationDto: PaginationDto, actor: Actor): Promise<any> {
    const { zoneId, search, page = 1, limit = 10, all = false } = paginationDto;

    let userZoneIds: string[] | null = null;
    if (!isAdmin(actor)) {
      userZoneIds = await loadUserZoneIds(this.dataSource.manager, actor.id);
      if (userZoneIds.length === 0) {
        const empty = {
          data: [],
          total: 0,
          page: 1,
          limit,
          lastPage: 1,
        };

        return empty;
      }
    }

    const queryBuilder = this.customerRepository
      .createQueryBuilder('customer')
      .leftJoinAndSelect('customer.zone', 'zone');

    if (zoneId) {
      queryBuilder.andWhere('zone.id = :zoneId', { zoneId });
    }

    if (userZoneIds !== null) {
      queryBuilder.andWhere('zone.id IN (:...userZoneIds)', { userZoneIds });
    }

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

    if (all) {
      const [data, total] = await queryBuilder.getManyAndCount();
      const result = {
        data,
        total,
        page: 1,
        limit: total,
        lastPage: 1,
      };
      return result;
    }

    const validPage = Math.max(1, page);
    const validLimit = Math.max(1, limit);
    const skip = (validPage - 1) * validLimit;

    queryBuilder.skip(skip).take(validLimit);

    const [data, total] = await queryBuilder.getManyAndCount();

    const result = {
      data,
      total,
      page: validPage,
      limit: validLimit,
      lastPage: Math.ceil(total / validLimit),
    };

    return result;
  }

  async findOne(id: string, actor: Actor) {
    const customer = await this.customerRepository.findOne({
      where: { id },
      relations: ['zone'],
    });

    if (!customer) throw new NotFoundException('Customer not found');

    await this.assertCustomerZoneAccess(customer, actor);

    return customer;
  }

  async findCredits(id: string, actor: Actor) {
    const customer = await this.customerRepository.findOne({
      where: { id },
      relations: ['accounts', 'zone'],
    });

    if (!customer) throw new NotFoundException('Customer not found');

    await this.assertCustomerZoneAccess(customer, actor);

    return customer.accounts;
  }

  private async assertCustomerZoneAccess(
    customer: { zone?: { id: string } | null },
    actor: Actor,
  ): Promise<void> {
    if (isAdmin(actor)) return;

    if (!customer.zone) {
      throw new ForbiddenException(
        'Customer has no zone assigned; cannot validate access',
      );
    }

    const userZoneIds = await loadUserZoneIds(
      this.dataSource.manager,
      actor.id,
    );
    if (!userZoneIds.includes(customer.zone.id)) {
      throw new ForbiddenException(
        'Customer is not within the user assigned zones',
      );
    }
  }

  async update(id: string, updateCustomerDto: UpdateCustomerDto) {
    const customer = await this.customerRepository.preload({
      id,
      ...updateCustomerDto,
    });

    if (!customer) throw new NotFoundException('Customer not found');

    if (updateCustomerDto.zoneId !== undefined) {
      if (updateCustomerDto.zoneId === null) {
        customer.zone = null;
      } else {
        const zone = await this.zoneRepository.findOne({
          where: { id: updateCustomerDto.zoneId },
        });

        if (!zone) throw new NotFoundException('Zone not found');
        customer.zone = zone;
      }
    }

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

    await this.customerRepository.softDelete(id);

    return 'Customer deleted successfully';
  }
}
