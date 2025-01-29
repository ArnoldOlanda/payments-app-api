import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe, Query } from '@nestjs/common';
import { AccountService } from './account.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { ValidRole } from 'src/auth/enums/validRoles.enum';
import { AccountStatus } from './enums/account-status.enum';
import { PaginateAccountDto } from './dto/paginate-account.dto';

@Controller('account')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Post()
  @Auth(ValidRole.ADMIN, ValidRole.PRESTAMISTA)
  create(@Body() createAccountDto: CreateAccountDto) {
    return this.accountService.create(createAccountDto);
  }

  @Get()
  @Auth(ValidRole.ADMIN, ValidRole.PRESTAMISTA)
  findAll(
    @Query() paginateAccountDto: PaginateAccountDto,
  ) {
    return this.accountService.findAll(paginateAccountDto);
  }

  @Get(':id')
  @Auth(ValidRole.ADMIN, ValidRole.PRESTAMISTA)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.accountService.findOne(id);
  }

  @Patch(':id')
  @Auth(ValidRole.ADMIN, ValidRole.PRESTAMISTA)
  update(
    @Param('id', ParseUUIDPipe) id: string, 
    @Body() updateAccountDto: UpdateAccountDto
  ) {
    return this.accountService.update(id, updateAccountDto);
  }

  @Delete(':id')
  @Auth(ValidRole.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.accountService.remove(id);
  }
}
