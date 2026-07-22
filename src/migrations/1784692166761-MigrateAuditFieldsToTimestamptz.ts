import { MigrationInterface, QueryRunner } from 'typeorm';

const FULL_AUDIT_TABLES: ReadonlyArray<{ table: string; columns: string[] }> = [
  { table: 'account', columns: ['createdAt', 'updatedAt', 'deletedAt'] },
  { table: 'payment', columns: ['createdAt', 'updatedAt', 'deletedAt'] },
  { table: 'user', columns: ['createdAt', 'updatedAt', 'deletedAt'] },
  { table: 'customer', columns: ['createdAt', 'updatedAt', 'deletedAt'] },
  { table: 'zone', columns: ['createdAt', 'updatedAt', 'deletedAt'] },
  { table: 'role', columns: ['createdAt', 'updatedAt', 'deletedAt'] },
  { table: 'refresh_token', columns: ['createdAt'] },
  { table: 'password_reset_token', columns: ['createdAt'] },
];

export class MigrateAuditFieldsToTimestamptz1784692166761
  implements MigrationInterface
{
  name = 'MigrateAuditFieldsToTimestamptz1784692166761';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const { table, columns } of FULL_AUDIT_TABLES) {
      for (const column of columns) {
        await queryRunner.query(
          `ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE TIMESTAMP WITH TIME ZONE USING "${column}" AT TIME ZONE 'UTC'`,
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const { table, columns } of [...FULL_AUDIT_TABLES].reverse()) {
      for (const column of [...columns].reverse()) {
        await queryRunner.query(
          `ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE TIMESTAMP USING "${column}" AT TIME ZONE 'UTC'`,
        );
      }
    }
  }
}
