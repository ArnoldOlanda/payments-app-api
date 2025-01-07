import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe, UseGuards, SetMetadata } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from 'src/auth/guards/user-role.guard';
import { RoleProtected } from 'src/auth/decorators/role-protected.decorator';
import { ValidRole } from 'src/auth/enums/validRoles.enum';
import { Auth } from 'src/auth/decorators/auth.decorator';

@Controller('customer')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Post()
  @Auth(ValidRole.PRESTAMISTA)
  create(@Body() createCustomerDto: CreateCustomerDto) {
    return this.customerService.create(createCustomerDto);
  }

  @Get()
  @Auth(ValidRole.PRESTAMISTA)
  findAll() {
    return this.customerService.findAll();
  }

  @Get(':id')
  @Auth(ValidRole.PRESTAMISTA)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.customerService.findOne(id);
  }

  @Patch(':id')
  @Auth(ValidRole.PRESTAMISTA)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateCustomerDto: UpdateCustomerDto) {
    return this.customerService.update(id, updateCustomerDto);
  }

  @Delete(':id')
  @Auth(ValidRole.PRESTAMISTA)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.customerService.remove(id);
  }
}
