import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { Customer } from 'src/customer/entities/customer.entity';
import { User } from 'src/user/entities/user.entity';

import { Actor } from 'src/auth/types/actor.type';
import { ValidRole } from '../enums/validRoles.enum';

const isAdmin = (user: Actor): boolean => user.role === ValidRole.ADMIN;

export const loadUserZoneIds = async (
  manager: EntityManager,
  userId: string,
): Promise<string[]> => {
  const user = await manager.findOne(User, {
    where: { id: userId },
    relations: ['zones'],
  });
  if (!user) {
    throw new NotFoundException(`User with id ${userId} not found`);
  }
  return (user.zones ?? []).map((z) => z.id);
};

export const assertCustomerInUserZones = async (
  manager: EntityManager,
  customerId: string,
  actor: Actor,
): Promise<void> => {
  if (isAdmin(actor)) return;

  const customer = await manager.findOne(Customer, {
    where: { id: customerId },
    relations: ['zone'],
  });
  if (!customer) {
    throw new NotFoundException(`Customer with id ${customerId} not found`);
  }
  if (!customer.zone) {
    throw new ForbiddenException(
      'Customer has no zone assigned; cannot validate access',
    );
  }

  const userZoneIds = await loadUserZoneIds(manager, actor.id);
  if (!userZoneIds.includes(customer.zone.id)) {
    throw new ForbiddenException(
      'Customer is not within the user assigned zones',
    );
  }
};
