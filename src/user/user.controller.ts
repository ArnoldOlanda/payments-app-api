import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignZonesDto } from './dto/assign-zones.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { ValidRole } from 'src/auth/enums/validRoles.enum';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { Actor } from 'src/auth/types/actor.type';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @Auth(ValidRole.ADMIN, ValidRole.PRESTAMISTA)
  getMe(@CurrentUser() actor: Actor) {
    return this.userService.getMe(actor);
  }

  @Post()
  @Auth(ValidRole.ADMIN)
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Get()
  @Auth(ValidRole.ADMIN)
  findAll() {
    return this.userService.findAll();
  }

  @Get(':id')
  @Auth(ValidRole.ADMIN)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.findOne(id);
  }

  @Patch(':id')
  @Auth(ValidRole.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.userService.update(id, updateUserDto);
  }

  @Delete(':id')
  @Auth(ValidRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.userService.remove(id);
  }

  @Patch(':id/zones')
  @Auth(ValidRole.ADMIN)
  assingZones(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() assignZonesDto: AssignZonesDto,
  ) {
    return this.userService.assingZones(id, assignZonesDto.zones_id);
  }

  @Get(':id/total-payments-today')
  @Auth(ValidRole.ADMIN, ValidRole.PRESTAMISTA)
  totalPaymentsToday(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: Actor,
  ) {
    const effectiveId = actor.role === ValidRole.ADMIN ? id : actor.id;
    return this.userService.totalPaymentsToday(effectiveId);
  }

  @Get(':id/customers')
  @Auth(ValidRole.ADMIN, ValidRole.PRESTAMISTA)
  findCustomers(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: Actor,
  ) {
    const effectiveId = actor.role === ValidRole.ADMIN ? id : actor.id;
    return this.userService.findCustomers(effectiveId);
  }
}
