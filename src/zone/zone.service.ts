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
    return this.zoneRepository.find();
  }

  async findOne(id: string) {
    const zone = await this.zoneRepository.findOne({where: {id}});
    if(!zone) {
      throw new NotFoundException(`Zone with id ${id} not found`);
    }

    return this.zoneRepository.findOne({where: {id}});
  }

  async update(id: string, updateZoneDto: UpdateZoneDto) {
    const zone = await this.zoneRepository.preload({
      id,
      ...updateZoneDto
    });

    if (!zone) {
      throw new NotFoundException(`Zone with id ${id} not found`);
    }
    return this.zoneRepository.save(zone);
  }

  async remove(id: string) {
    const zone = await this.zoneRepository.findOne({where: {id}});
    if (!zone) {
      throw new NotFoundException('Zone with id ${id} not found');
    }
    await this.zoneRepository.softDelete(id);
    return 'Zone deleted successfully';
  }
}
