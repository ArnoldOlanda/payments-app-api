import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { AccountService } from './account.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { ValidRole } from 'src/auth/enums/validRoles.enum';
import { PaginateAccountDto } from './dto/paginate-account.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { Actor } from 'src/auth/types/actor.type';

@Controller('account')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Post()
  @Auth(ValidRole.ADMIN, ValidRole.PRESTAMISTA)
  create(
    @Body() createAccountDto: CreateAccountDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.accountService.create(createAccountDto, actor);
  }

  @Get()
  @Auth(ValidRole.ADMIN, ValidRole.PRESTAMISTA)
  findAll(
    @Query() paginateAccountDto: PaginateAccountDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.accountService.findAll(paginateAccountDto, actor);
  }

  @Get(':id')
  @Auth(ValidRole.ADMIN, ValidRole.PRESTAMISTA)
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: Actor) {
    return this.accountService.findOne(id, actor);
  }

  @Patch(':id')
  @Auth(ValidRole.ADMIN, ValidRole.PRESTAMISTA)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateAccountDto: UpdateAccountDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.accountService.update(id, updateAccountDto, actor);
  }

  @Delete(':id')
  @Auth(ValidRole.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.accountService.remove(id);
  }
}
