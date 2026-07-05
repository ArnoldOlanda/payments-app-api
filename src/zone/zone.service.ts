import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateZoneDto } from './dto/create-zone.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Zone } from './entities/zone.entity';
import { Repository } from 'typeorm';

@Injectable()
export class ZoneService {
  constructor(
    @InjectRepository(Zone)
    private readonly zoneRepository: Repository<Zone>,
  ) {}

  create(createZoneDto: CreateZoneDto) {
    return this.zoneRepository.save(createZoneDto);
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
