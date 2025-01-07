import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe } from '@nestjs/common';
import { AccountService } from './account.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { ValidRole } from 'src/auth/enums/validRoles.enum';

@Controller('account')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Post()
  @Auth(ValidRole.PRESTAMISTA)
  create(@Body() createAccountDto: CreateAccountDto) {
    return this.accountService.create(createAccountDto);
  }

  @Get()
  @Auth(ValidRole.PRESTAMISTA)
  findAll() {
    return this.accountService.findAll();
  }

  @Get(':id')
  @Auth(ValidRole.PRESTAMISTA)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.accountService.findOne(id);
  }

  @Patch(':id')
  @Auth(ValidRole.PRESTAMISTA)
  update(
    @Param('id', ParseUUIDPipe) id: string, 
    @Body() updateAccountDto: UpdateAccountDto
  ) {
    return this.accountService.update(id, updateAccountDto);
  }

  @Delete(':id')
  @Auth(ValidRole.PRESTAMISTA)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.accountService.remove(id);
  }
}
