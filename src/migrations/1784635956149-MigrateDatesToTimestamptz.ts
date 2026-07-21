import { MigrationInterface, QueryRunner } from 'typeorm';

export class MigrateDatesToTimestamptz1784635956149
  implements MigrationInterface
{
  name = 'MigrateDatesToTimestamptz1784635956149';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payment" ALTER COLUMN "date" TYPE TIMESTAMP WITH TIME ZONE USING "date" AT TIME ZONE 'America/Lima'`,
    );
    await queryRunner.query(
      `ALTER TABLE "account" ALTER COLUMN "date" TYPE TIMESTAMP WITH TIME ZONE USING "date" AT TIME ZONE 'America/Lima'`,
    );
    await queryRunner.query(
      `ALTER TABLE "account" ALTER COLUMN "dueDate" TYPE TIMESTAMP WITH TIME ZONE USING "dueDate" AT TIME ZONE 'America/Lima'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "account" ALTER COLUMN "dueDate" TYPE TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "account" ALTER COLUMN "date" TYPE TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment" ALTER COLUMN "date" TYPE TIMESTAMP`,
    );
  }
}