import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe } from '@nestjs/common';
import { CreditTypeService } from './credit-type.service';
import { CreateCreditTypeDto } from './dto/create-credit-type.dto';
import { UpdateCreditTypeDto } from './dto/update-credit-type.dto';

@Controller('credit-type')
export class CreditTypeController {
  constructor(private readonly creditTypeService: CreditTypeService) {}

  @Post()
  create(@Body() createCreditTypeDto: CreateCreditTypeDto) {
    return this.creditTypeService.create(createCreditTypeDto);
  }

  @Get()
  findAll() {
    return this.creditTypeService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.creditTypeService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string, 
    @Body() updateCreditTypeDto: UpdateCreditTypeDto
  ) {
    return this.creditTypeService.update(id, updateCreditTypeDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.creditTypeService.remove(id);
  }
}
