import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateZoneDto } from './dto/create-zone.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Zone } from './entities/zone.entity';
import { User } from 'src/user/entities/user.entity';
import { Repository } from 'typeorm';
import { Actor } from 'src/auth/types/actor.type';

@Injectable()
export class ZoneService {
  constructor(
    @InjectRepository(Zone)
    private readonly zoneRepository: Repository<Zone>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(createZoneDto: CreateZoneDto, actor: Actor) {
    const zone = await this.zoneRepository.save(createZoneDto);

    await this.userRepository
      .createQueryBuilder()
      .relation('zones')
      .of(actor.id)
      .add(zone.id);

    return zone;
  }

  findAll() {
    return this.zoneRepository.find({ relations: ['customers'] });
  }

  async findOne(id: string) {
    const zone = await this.zoneRepository.findOne({ where: { id } });
    if (!zone) {
      throw new NotFoundException(`Zone with id ${id} not found`);
    }

    return zone;
  }

  async update(id: string, updateZoneDto: UpdateZoneDto) {
    const zone = await this.zoneRepository.preload({
      id,
      ...updateZoneDto,
    });

    if (!zone) {
      throw new NotFoundException(`Zone with id ${id} not found`);
    }
    return this.zoneRepository.save(zone);
  }

  async remove(id: string) {
    try {
      await this.findOne(id);

      await this.userRepository.query(
        `DELETE FROM user_zones_zone WHERE "zoneId" = $1`,
        [id],
      );

      await this.zoneRepository.softDelete(id);

      return 'Zone deleted successfully';
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(`Zone with id ${id} not found`);
      }
      throw error;
    }
  }
}
