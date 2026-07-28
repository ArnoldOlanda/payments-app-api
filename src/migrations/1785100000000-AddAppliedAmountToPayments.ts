import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAppliedAmountToPayments1785100000000
  implements MigrationInterface
{
  name = 'AddAppliedAmountToPayments1785100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payment" ADD "appliedAmount" double precision`,
    );
    await queryRunner.query(
      `UPDATE "payment" SET "appliedAmount" = "amount" WHERE "appliedAmount" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment" ALTER COLUMN "appliedAmount" SET NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payment" DROP COLUMN "appliedAmount"`,
    );
  }
}
