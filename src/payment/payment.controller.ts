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
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { ValidRole } from 'src/auth/enums/validRoles.enum';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { Actor } from 'src/auth/types/actor.type';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  @Auth(ValidRole.ADMIN, ValidRole.PRESTAMISTA)
  create(
    @Body() createPaymentDto: CreatePaymentDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.paymentService.create(createPaymentDto, actor);
  }

  @Get()
  @Auth(ValidRole.ADMIN, ValidRole.PRESTAMISTA)
  findAll(
    @Query('accountId', ParseUUIDPipe) accountId: string,
    @CurrentUser() actor: Actor,
  ) {
    return this.paymentService.findAll(accountId, actor);
  }

  @Get(':id')
  @Auth(ValidRole.ADMIN, ValidRole.PRESTAMISTA)
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: Actor) {
    return this.paymentService.findOne(id, actor);
  }

  @Patch(':id')
  @Auth(ValidRole.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePaymentDto: UpdatePaymentDto,
  ) {
    return this.paymentService.update(id, updatePaymentDto);
  }

  @Delete(':id')
  @Auth(ValidRole.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentService.remove(id);
  }
}
